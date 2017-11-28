
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

    fields.started = false;
    fields.downstreams = [];
    fields.upstreams = [];
    fields.dueEnd = null;
    fields.dueIndex = 0;
    fields.list = define.list;

    this._progressCustom = define.progress;
    this._resetCustom = define.reset;
    this._progressNotify = bind(progressNotify, this);
}

var taskProto = Task.prototype;

/**
 * @param {Object} [params]
 */
taskProto.reset = function (params) {
    var fields = inner(this);

    fields.started = false;

    this._resetCustom && this._resetCustom(params);

    fields.dueEnd = fields.upstreams.length ? 0 : null;
    fields.dueIndex = 0;

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

function progressNotify(dueIndex, downstreamDueEnd) {
    var fields = inner(this);

    assert(dueIndex != null);

    fields.dueIndex = dueIndex;

    var downstreamPlan = {
        dueEnd: downstreamDueEnd != null ? downstreamDueEnd : dueIndex
    };

    each(fields.downstreams, function (downTask) {
        downTask.plan(downstreamPlan);
    });
}

/**
 * @param {Object} params
 * @param {number} params.dueEnd
 */
taskProto.plan = function (params) {
    assert(params.dueEnd != null);
    inner(this).dueEnd = params.dueEnd;
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
    assert(!fields.started && downTask.plan);

    var downTaskUpstreams = inner(downTask).upstreams;
    if (indexOf(downTaskUpstreams, this) >= 0) {
        return;
    }

    fields.downstreams.push(downTask);
    downTaskUpstreams.push(this);

    downTask.reset();

    return downTask;
};

// ??? whether use remove to remove itself from container list, or
// its container responsible for it?
/**
 * Remove itself from the task pipeline.
 */
taskProto.remove = function () {
    var fields = inner(this);
    var thisTask = this;

    each(fields.upstreams, function (upTask) {
        var upTaskDownstreams = inner(upTask).downstreams;
        for (var i = upTaskDownstreams.length - 1; i >= 0; i--) {
            upTaskDownstreams[i] === thisTask && upTaskDownstreams.splice(i, 1);
        }
    });

    fields.upstreams.length = 0;
};
