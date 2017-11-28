
import {assert, each, bind, makeInner, indexOf} from './util';

var inner = makeInner();

/**
 * @param {Object} define
 * @param {Function} define.progress
 * @param {Object} define.list {count: Function}
 * @return See the return of `createTask`.
 */
export function createTask(define) {
    return new Task(define);
}

/**
 * @return {boolean}
 */
export function isTask(obj) {
    return obj instanceof Task;
}

// ----------------
// Task
// ----------------

/**
 * @constructor
 * @param {Object} define
 * @param {Function} define.progress Custom progress
 * @param {Function} define.reset Custom reset
 * @param {Function} define.list {count: Function}
 */
function Task(define) {
    var fields = inner(this);

    fields.downstreams = [];
    fields.upstreams = [];
    fields.list = define.list;

    this._progressCustom = define.progress;
    this._resetCustom = define.reset;
    this._progressNotify = bind(progressNotify, this);

    this.reset();
}

var taskProto = Task.prototype;

/**
 * @param {Object} [params]
 */
taskProto.reset = function (params) {
    var fields = inner(this);

    fields.started = false;
    fields.dueEnd = fields.upstreams.length ? 0 : null;
    fields.dueIndex = 0;
    fields.outputDueEnd = 0;

    this._resetCustom && this._resetCustom(params);

    each(fields.downstreams, function (downTask) {
        downTask.reset(params);
    });
};

/**
 * @param {Object} [params]
 * @param {number} [params.step] Specified step.
 *  If not specified, progress to current dueEnd.
 */
taskProto.progress = function (params) {
    params = params || {};
    var fields = inner(this);

    fields.started = true;

    this._progressCustom({
        dueEnd: Math.min(
            params.step != null ? fields.dueIndex + params.step : Infinity,
            fields.dueEnd != null ? fields.dueEnd : Infinity,
            fields.list.count()
        ),
        dueIndex: fields.dueIndex
    }, this._progressNotify);
};

function progressNotify(dueIndex, outputDueEnd) {
    var fields = inner(this);

    assert(dueIndex != null);

    fields.dueIndex = dueIndex;

    // If no `outputDueEnd`, assume that output data and
    // input data is the same, so use `dueIndex` as `outputDueEnd`.
    fields.outputDueEnd = outputDueEnd != null ? outputDueEnd : dueIndex;

    each(fields.downstreams, function (downTask) {
        downTask.plan();
    });
}

/**
 * Receive notify. ??? Only on notify? check pipe.
 */
taskProto.plan = function () {
    var fields = inner(this);

    var upDueEnd;
    each(fields.upstreams, function (upTask) {
        var dueEnd = upTask.getOutputDueEnd();
        upDueEnd = upDueEnd != null
            // Current no scenario that upstreams
            // outputs data are not the same.
            ? Math.min(upDueEnd, dueEnd)
            : dueEnd;
    });

    assert(upDueEnd >= fields.dueEnd);
    fields.dueEnd = upDueEnd;
};

/**
 * @return {number}
 */
taskProto.getOutputDueEnd = function () {
    return inner(this).outputDueEnd;
};

/**
 * @return {boolean}
 */
taskProto.unfinished = function () {
    var fields = inner(this);

    return fields.dueIndex < (
        fields.dueEnd != null
            ? fields.dueEnd : fields.list.count()
    );
};

/**
 * @param {Object} downTask The downstream task.
 * @return {Object} The downstream task.
 */
taskProto.pipe = function (downTask) {
    var fields = inner(this);

    var downTaskUpstreams = inner(downTask).upstreams;
    if (indexOf(downTaskUpstreams, this) >= 0) {
        return;
    }

    downTask.reset();

    fields.downstreams.push(downTask);
    downTaskUpstreams.push(this);

    downTask.plan();

    return downTask;
};

// /**
//  * Remove from pipeline.
//  * @param {Object} downTask
//  */
// taskProto.unpipe = function (downTask) {
//     clearDownTaskUpstreams(downTask, this);

//     var downstreams = inner(this).downstreams;
//     var downstreamIndex = indexOf(downstreams, downTask);
//     if (downstreamIndex >= 0) {
//         downstreams.splice(downstreamIndex, 1);
//     }

//     // Stop downstreams.
//     downTask.reset();
// };

/**
 * Remove all downstreams.
 */
taskProto.clearDownstreams = function () {
    var downstreams = inner(this).downstreams;
    each(downstreams, clearTask);
    downstreams.length = 0;
};

function clearTask(task) {
    // Leave.
    var upstreams = inner(task).upstreams;
    each(upstreams, function (upTask) {
        var upTaskDownstreams = inner(upTask).downstreams;
        // That upTaskDownstreams contains task has been ensured.
        upTaskDownstreams.splice(indexOf(upTaskDownstreams, task), 1);
    });
    upstreams.length = 0;
    // Stop.
    task.reset();
}
