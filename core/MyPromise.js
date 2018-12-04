// https://juejin.im/post/5ac71bdff265da238059e236
var STATE = {
    PENDING: 'pending',
    FULFILLED: 'fulfilled',
    REJECTED: 'rejected'
}

var UNDEFINED = void 0;

var TYPE = {
    FUNCTION: 'function',
    UNDEFINED: 'undefined',
    OBJECT: 'object'
}

function asap(fn) {
    setTimeout(fn, 4);
}

function throwException(message) {
    throw new TypeError(message);
}

function MPromise(resolver) {
    var self = this;
    self.state = STATE.PENDING;
    self.value = UNDEFINED;
    self.reason = UNDEFINED;
    self.onFulfilledCallbacks = [];
    self.onRejectedCallbacks = [];

    function resolve(value) {
        if (STATE.PENDING === self.state) {
            self.state = STATE.FULFILLED;
            self.value = value;
            self.onFulfilledCallbacks.forEach(function (fn) {
                fn();
            })
        }
    }

    function reject(reason) {
        if (STATE.PENDING === self.state) {
            self.state = STATE.REJECTED;
            self.reason = reason;
            self.onRejectedCallbacks.forEach(function (fn) {
                fn();
            })
        }
    }

    try {
        resolver(resolve, reject)
    } catch (reason) {
        reject(reason)
    }
}

function resolvePromise(promise, x, resolve, reject) {
    (promise === x) && (throwException('Cannot resolve promise with itself'));
    var called;

    if (null !== x && TYPE.OBJECT === typeof x || TYPE.FUNCTION === typeof x) {
        try {
            // 判断x是不是promise，如果x是对象并且x的then方法是函数我们就认为他是一个promise
            var _then = x.then;
            if (TYPE.FUNCTION === typeof _then) {
                _then.call(
                    x,
                    function (value) {
                        if (called) return;
                        called = true;
                        // y可能还是一个promise，在去解析直到返回的是一个普通值
                        resolvePromise(promise, value, resolve, reject)
                    },
                    function (reason) {
                        if (called) return;
                        called = true;
                        reject(reason);
                    }
                )
            } else {
                resolve(x);
            }

        } catch (reason) {
            if (called) return;
            called = true;
            reject(reason);
        }
    }
}

Promise.prototype.then = function (onFulfilled, onRejected) {
    onFulfilled = TYPE.FUNCTION === typeof onFulfilled ? onFulfilled : function (value) {
            return value;
        }
    onRejected = TYPE.FUNCTION === typeof onRejected ? onRejected : function (reason) {
            throw reason;
        }
    var self = this;
    var promise_then;

    if (STATE.FULFILLED === self.state) {
        promise_then = new MPromise(function (resolve, reject) {
            asap(function () {
                try {
                    var x = onFulfilled(self.value);
                    resolvePromise(promise_then, x, resolve, reject);
                } catch (reason) {
                    reject(reason);
                }
            })
        })
    }

    if (STATE.REJECTED === self.state) {
        promise_then = new MPromise(function (resolve, reject) {
            asap(function () {
                try {
                    var x = onRejected(self.reason);
                    resolvePromise(promise_then, x, resolve, reject);
                } catch (resaon) {
                    reject(resaon);
                }
            })
        })
    }

    if (STATE.PENDING === self.state) {
        promise_then = new MPromise(function (resolve, reject) {
            self.onFulfilledCallbacks.push(function () {
                asap(function () {
                    try {
                        var x = onFulfilled(self.value);
                        resolvePromise(promise_then, x, resolve, reject);
                    } catch (reason) {
                        reject(reason)
                    }
                })
            });

            self.onRejectedCallbacks.push(function () {
                asap(function () {
                    try {
                        var x = onRejected(self.reason);
                        resolvePromise(promise_then, x, resolve, reject);
                    } catch (reason) {
                        reject(reason)
                    }
                })
            })
        })
    }
    return promise_then;
}