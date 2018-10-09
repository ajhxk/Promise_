/**
 * Created by 未响应 on 2018/10/5.
 */
const TYPE = {
  FUNCTION: 'function',
  UNDEFINED: void 0,
  OBJECT: 'object'
}

const STATE = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  REJECTED: 'rejected'
}

// 用于注册then中的回调 .then(resolvedFn, rejectedFn)
function CallbackItem(promise, onResolved, onRejected) {
  this.promise = promise;
  // 为了保证在promise链中,resolve或reject的结果可以一直向后传递，可以默认给then添加resolveedFn和rejectedFn
  this.onResolved = TYPE.FUNCTION === typeof onResolved ? onResolved : function (v) {
      return v;
    }

  this.onRejected = TYPE.FUNCTION === typeof onRejected ? onRejected : function (v) {
      return v;
    }
}

CallbackItem.prototype.resolve = function (value) {
  // 调用时异步调用 [标准 2.2.4]
  executeCallbackAsync.bind(this.promise)(this.onResolved, value);
}

CallbackItem.prototype.reject = function (value) {
  // 调用时异步调用[标准 2.2.4]
  executeCallbackAsync.bind(this.promise)(this.onRejected, value);
}

function getThen(obj) {
  var then = obj && obj.then;
  if (obj && TYPE.OBJECT === typeof obj && TYPE.FUNCTION === typeof then) {
    return function applyThen() {
      then.apply(obj, arguments);
    }
  }
}

// 用于执行成功或者失败的回调 new Promise((resolve, reject) => {resolve(1 或 reject(2))})
function executeCallback(type, x) {
  var isResolve = type === STATE.RESOLVED, thenable;

  // [标准 2.3.3] 如果x是一个对象或者一个函数
  if (isResolve && (TYPE.OBJECT === typeof x || TYPE.FUNCTION === typeof x)) {
    // [标准 2.3.3.2]
    try {
      thenable = getThen(x);
    } catch (e) {
      return executeCallback.bind(this)(STATE.REJECTED, e)
    }
  }

  if (isResolve && thenable) {
    executeResolver.bind(this)(thenable);
  }
  // [标准 2.3.4]
  else {
    this.state = isResolve ? STATE.RESOLVED : STATE.REJECTED;
    this.data = x;
    this.callbackQueue && this.callbackQueue.length && this.callbackQueue.forEach(v => v[type](x));
  }
  return this;
}

//用于异步执行 .then(onResolved, onRejected中注册的回调)
function executeCallbackAsync(callback, value) {
  var _this = this;
  setTimeout(function () {
    var res;
    try {
      res = callback(value);
    } catch (e) {
      return executeCallback.bind(_this)(STATE.REJECTED, e);
    }

    if (res !== _this) {
      return executeCallback.bind(_this)(STATE.RESOLVED, res)
    } else {
      return executeCallback.bind(_this)(STATE.REJECTED, new TypeError('Cannot resolve promise with itself'))
    }
  })
}


// 用于执行new Promise(function(resolve, reject){})中的resolve或reject方法
function executeResolver(resolver) {
  // [标准 2.3.3.3.3] 如果resolve()方法多次调用,只响应第一次，后面忽略
  var called = false, _this = this;

  function onError(value) {
    if (called) return;
    called = true;
    // [标准 2.3.3.3.2] 如果错误,使用reject方法
    executeCallback.bind(_this)(STATE.REJECTED, value);
  }

  function onSuccuss(value) {
    if (called) return;
    called = true;
    // [标准 2.3.3.3.1] 如果成功,使用resolve方法
    executeCallback.bind(_this)(STATE.RESOLVED, value);
  }

  // 使用try...catch执行
  // [标准 2.3.3.3.4] 如果调用resolve()或者reject()时发生错误,则将状态改成rejected，并将错误reject出去
  try {
    resolver(onSuccuss, onError)
  } catch (e) {
    onError(e);
  }
}


function Promise_(resolver) {
  if (resolver && TYPE.FUNCTION === typeof resolver) {
    throw new TypeError('Promise resolver must be a function');
  }

  // 初始化当前promise对象的状态
  this.state = STATE.PENDING;
  // 当前promise对象的数据(成功或者失败)
  this.data = TYPE.UNDEFINED;
  // 当前promise对象注册的回调队列
  this.callbackQueue = [];
  // 执行resolve()或者reject()方法
  (resolver) && (executeResolver.call(this, resolver));
}

Promise_.prototype.then = function (onResolved, onRejected) {
  // [标准 2.2.1 - 2.2.2] 状态已经发生改变并且参数不是函数时，则忽略
  if (TYPE.FUNCTION !== typeof onResolved && STATE.RESOLVED === this.state ||
    TYPE.FUNCTION !== typeof onRejected && STATE.REJECTED === this.state) {
    return this;
  }

  var promise = new this.constructor();

  // 一般情况下，状态发生改变时，走这里
  if (STATE.PENDING !== this.state) {
    var callback = this.state === STATE.RESOLVED ? onResolved : onRejected;
    // 将上一步resolve(value)或reject(value)的value传递给then中注册的callback
    // [标准 2.2.4] 异步调用callback
    executeCallbackAsync.bind(promise)(callback, this.data);
  } else {
    // var promise = new Promise(resolve=>resolve(1));promise.then(...);promise.then(...)
    // 一个实例执行对次then，这种情况会走这里[标准 2.2.6]
    this.callbackQueue.push(new CallbackItem(promise, onResolved, onRejected))
  }
  // 返回新的实例[标准 2.2.7]
  return promise;
}

Promise_.prototype.catch = function (onRejected) {
  return this.then(null, onRejected);
}
