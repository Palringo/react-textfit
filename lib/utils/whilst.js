const noop = () => {};

/**
 * Repeatedly call fn, while test returns true. Calls callback when stopped, or an error occurs.
 *
 * @param {Function} test Synchronous truth test to perform before each execution of fn.
 * @param {Function} fn A function which is called each time test passes. The function is passed a callback(err), which must be called once it has completed with an optional err argument.
 * @param {Function} callback A callback which is called after the test fails and repeated execution of fn has stopped.
 */

// eslint-disable-next-line consistent-return
export default function whilst(test, iterator, callback = noop) {
    if (test()) {
        // eslint-disable-next-line consistent-return
        iterator(function next(err, ...args) {
            if (err) {
                return callback(err);
            } else if (Reflect.apply(test, this, args)) {
                iterator(next);
            } else {
                return callback(null);
            }
        });
    } else {
        return callback(null);
    }
}
