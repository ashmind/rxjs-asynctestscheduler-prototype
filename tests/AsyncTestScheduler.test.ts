import { of } from 'rxjs';
import { map, mergeMap } from "rxjs/operators";
import { AsyncTestScheduler } from '../AsyncTestScheduler';

let testScheduler: AsyncTestScheduler;
beforeEach(() => {
  testScheduler = new AsyncTestScheduler((actual, expected) => {
    expect(actual).toEqual(expected);
  });
});

it("should support marble tests", (async () => {
    await testScheduler.runAsync(({ hot, expectObservable }) => {
        const source =  hot("--^-a-b-c-|");
        //const subs =            "^-------!";
        const expected =        "--b-c-d-|";

        const destination = source.pipe(
            map(value => String.fromCharCode(value.charCodeAt(0) + 1))
        );
        expectObservable(destination).toBe(expected);
        //expectSubscriptions(source).toBe(subs);
    });
}));

it('(promise, of(...), const)', (async () => {
    await testScheduler.runAsync(({ cold, expectObservable }) => {
        const observable = cold('(abc|)').pipe(mergeMap((x:'a'|'b'|'c') => {
          switch (x) {
            case 'a':
              //console.log('returning a');
              return 'a';
            case 'b': {
              //console.log('returning promise for b');
              const promisedB = (async () => {
                //console.log('returning b from promise');
                return 'b';
              })();
              /*promisedB.then(() => {
                console.log('resolved b');
              });*/

              return promisedB;
            }
            case 'c': {
              //console.log('returning of(c)');
              const ofC = of('c');
              /*ofC.subscribe(() => {
                console.log('producing c');
              });*/
              return ofC;
            }
          }
        }));
        expectObservable(observable).toBe('(abc|)');
    });
}));

it('promise, error', (async () => {
  await testScheduler.runAsync(({ cold, expectObservable }) => {
      const observable = cold('-a-#').pipe(mergeMap(x => Promise.resolve(x)));
      expectObservable(observable).toBe('-a-#');
  });
}));

it('promise, frame delay, promise', (async () => {
  await testScheduler.runAsync(({ cold, expectObservable }) => {
      const observable = cold('-a-----b').pipe(mergeMap(x => Promise.resolve(x)));
      expectObservable(observable).toBe('-a-----b');
  });
}));

it('promise, time delay, promise', (async () => {
  await testScheduler.runAsync(({ cold, expectObservable }) => {
      const observable = cold('-a 10ms b').pipe(mergeMap(x => Promise.resolve(x)));
      expectObservable(observable).toBe('-a 10ms b');
  });
}));