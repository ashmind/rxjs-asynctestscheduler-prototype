import { Observable } from "rxjs";
import { TestScheduler } from "rxjs/testing";
import { RunHelpers } from "rxjs/internal/testing/TestScheduler";
import { AsyncAction } from "rxjs/internal/scheduler/AsyncAction";
import { AsyncScheduler } from "rxjs/internal/scheduler/AsyncScheduler";

export class AsyncTestScheduler extends TestScheduler {
  private asyncQueue: ([string, () => any])[];

  run<T>(callback: (helpers: RunHelpers) => T): T {
    throw new Error("Use runAsync instead.");
  }

  expectObservable(observable: Observable<any>, subscriptionMarbles: string|undefined = undefined) {
    let result;
    this.asyncQueue.push(['expectObservable', () => {
      result = super.expectObservable(observable, subscriptionMarbles);
    }]);
    return {
        toBe: (marbles: string, values?: any, errorValue?: any) => {
            this.asyncQueue.push(['toBe', async () => {
              result.toBe(marbles, values, errorValue);
            }]);
        }
    };
  }

  flush(): void {
    if (!this.asyncQueue)
      throw new Error('Use flushAsync instead.');

    this.asyncQueue.push(['flush', async () => {
      const hotObservables = this.hotObservables;
      while (hotObservables.length > 0) {
        hotObservables!.shift()!.setup();
      }

      const {actions, maxFrames} = this;
      let error: any, action: AsyncAction<any>|undefined;

      while ((action = actions[0]) && action.delay <= maxFrames) {
        actions.shift();
        this.frame = action.delay;

        if (error = action.execute(action.state, action.delay)) {
          break;
        }
        await this.waitForAllPendingPromises();
      }

      if (error) {
        while (action = actions.shift()) {
          action.unsubscribe();
        }
        throw error;
      }

      (this as any).flushTests = (this as any).flushTests.filter(test => {
        if (test.ready) {
          this.assertDeepEqual(test.actual, test.expected);
          return false;
        }
        return true;
      });
    }]);
  }

  async flushAsync() {
    this.asyncQueue = [];
    this.flush();
    await this.waitForAsyncQueue();
  }

  async runAsync<T>(callback: (helpers: RunHelpers) => T): Promise<T> {
    this.asyncQueue = [];
    const result = super.run(callback);

    const prevFrameTimeFactor = TestScheduler.frameTimeFactor;
    const prevMaxFrames = this.maxFrames;

    try {
      TestScheduler.frameTimeFactor = 1;
      this.maxFrames = Number.POSITIVE_INFINITY;
      (this as any).runMode = true;
      AsyncScheduler.delegate = this;

      await this.waitForAsyncQueue();
      return result;
    }
    finally {
      TestScheduler.frameTimeFactor = prevFrameTimeFactor;
      this.maxFrames = prevMaxFrames;
      (this as any).runMode = false;
      AsyncScheduler.delegate = undefined;
    }
  }

  async waitForAsyncQueue() {
    for (const [, action] of this.asyncQueue) {
      await Promise.resolve(action());
    }
  }

  async waitForAllPendingPromises() {
    await new Promise(resolve => resolve());
  }
}