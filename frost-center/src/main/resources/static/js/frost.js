let frostApp = angular.module("frost",
    ["ui.router", 'ui.bootstrap', 'angularjs-dropdown-multiselect']);

frostApp.config(
    function ($stateProvider, $urlRouterProvider, $locationProvider) {
      $locationProvider.html5Mode(false);
      $urlRouterProvider.otherwise("/");
      $stateProvider.state("executors", {
        url: "/executors",
        templateUrl: "executors.html",
        controller: executorsController
      }).state("jobs", {
        url: "/jobs",
        templateUrl: "jobs.html",
        controller: jobsController
      }).state("logs", {
        url: "/logs",
        params: {
          executorId: null,
          jobId: null
        },
        templateUrl: "logs.html",
        controller: logsController
      }).state("script", {
        url: "/script",
        params: {
          jobId: null
        },
        templateUrl: "script.html",
        controller: scriptController
      }).state("statistics", {
        url: "/",
        templateUrl: "statistics.html",
        controller: statisticsController
      });
    });

frostApp.controller('appModalInstanceCtrl',
    function ($scope, $uibModalInstance, modalDatas) {
      let $ctrl = this;
      // 双向绑定，方便在确认中回传可能修改的字段
      $scope.modalDatas = modalDatas;

      $ctrl.ok = function (val) {
        if ($scope.modalDatas.ok) {
          let rsp = $scope.modalDatas.ok();
          if (rsp === false) {
            return;
          }
          rsp.then(function (resp) {
            if (resp.data.success) {
              $uibModalInstance.close($scope.modalDatas);
            }
          });
          return;
        }
        // 在模态框View中修改的值传递回去，view中可以直接添加属性
        $uibModalInstance.close($scope.modalDatas);
      };

      $ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

      $ctrl.executorChange = function () {
        if ($scope.modalDatas.groupKey) {
          $scope.modalDatas.jobs = $scope.modalDatas.executorMap[$scope.modalDatas.groupKey];
          if ($scope.modalDatas.jobs && $scope.modalDatas.jobs.length > 0) {
            $scope.modalDatas.jobKey = $scope.modalDatas.jobs[0].jobKey;
          }
        }
      };

    });

function executorsController($rootScope, $scope, $http, $filter, $state) {

  $scope.searchFilter = '';
  $rootScope.navActive = 0;

  $scope.toggleExpandAll = function () {
    $scope.expandAll = !$scope.expandAll;
    $scope.executors.forEach(r => r.group.collapsed = !$scope.expandAll);
  };

  $scope.queryExecutors = function () {
    $http.get('queryExecutors').success(function (data) {
      if (data.success) {
        $scope.executorList = data.data;
        let map = new Map();
        var rs = [];
        $scope.executorList.forEach(r => {
          if (!map.has(r.key)) {
            map.set(r.key, []);
          }
          map.get(r.key).push(r);
        });
        map.forEach((v, k) => {
          rs.push({
            group: {
              groupKey: k,
              count: v.length
            },
            apps: v
          });
        });
        $scope.executors = rs;
      }
    });
  };

  $scope.queryExecutors();

  $scope.doFilter = function (value) {
    if (!$scope.searchFilter) {
      return true;
    }
    let projection = angular.copy(value);
    return $filter('filter')([projection], $scope.searchFilter).length > 0;
  };

  $scope.jumpToLogs = function (id) {
    $state.go("logs", {executorId: id});
  }
}

function jobsController($rootScope, $scope, $http, $filter, $uibModal, $state) {

  $scope.searchFilter = '';
  $rootScope.navActive = 1;

  $scope.defaultScript =
      `package vip.justlive.frost.executor.example;
 
import vip.justlive.frost.core.job.BaseJob;
import vip.justlive.frost.core.job.JobContext;

public class DemoScriptJob extends BaseJob {
 
 @Override
 public void execute(JobContext ctx) {
   System.out.println(String.format("参数：%s", ctx.getParam()));
 }
 
}`;

  $scope.pageIndex = 1;
  $scope.pageSize = 10;

  $scope.queryJobs = function () {
    $http.post('queryJobInfos', {}, {
      params: {
        pageIndex: $scope.pageIndex,
        pageSize: $scope.pageSize
      }
    }).then(function (resp) {
      let data = resp.data;
      if (data.success) {
        $scope.totalCount = data.data.totalCount;
        $scope.jobs = data.data.items;
      }
    });
  };

  $scope.queryJobs();

  $scope.doFilter = function (value) {
    if (!$scope.searchFilter) {
      return true;
    }
    let projection = angular.copy(value);
    delete projection.logId;
    delete projection.taskId;
    return $filter('filter')([projection], $scope.searchFilter).length > 0;
  };

  $scope.extraSettings = {
    scrollableHeight: '150px',
    scrollable: true,
    showCheckAll: false,
    showUncheckAll: false,
    smartButtonMaxItems: 3,
    buttonClasses: 'btn btn-default modal-multi-btn'
  };

  $scope.translationTexts = {
    buttonDefaultText: '配置子任务'
  };

  $scope.addJob = function () {

    $scope.modalDatas = {opt: 1};
    $scope.modalDatas.type = 'BEAN';
    $scope.modalDatas.failStrategy = 'NOTIFY';
    $scope.modalDatas.mode = 'CRON';
    $scope.modalDatas.childrenJobs = [];
    $scope.modalDatas.extraSettings = $scope.extraSettings;
    $scope.modalDatas.translationTexts = $scope.translationTexts;

    $http.get('queryExecutors').success(function (data) {
      if (data.success) {

        transferExecutor(data.data, $scope.modalDatas);

        if (data.data.length > 0) {
          $scope.modalDatas.groupKey = data.data[0].key;
          $scope.modalDatas.jobs = $scope.modalDatas.executorMap[$scope.modalDatas.groupKey];
          if (data.data[0].groups && data.data[0].groups.length > 0) {
            $scope.modalDatas.jobKey = data.data[0].groups[0].jobKey;
          }
        }
      }
    });

    $http.get('queryAllJobs').success(function (data) {
      if (data.success) {
        $scope.modalDatas.jobInfos = [];
        data.data.forEach(r => {
          $scope.modalDatas.jobInfos.push({id: r.id, label: r.name});
        });
      }
    });

    var modal = $uibModal.open({
      animation: true,
      ariaLabelledBy: 'modal-title',
      ariaDescribedBy: 'modal-body',
      templateUrl: "addJob.html",
      controller: 'appModalInstanceCtrl',
      controllerAs: '$ctrl',
      windowClass: 'modal-addJob',
      resolve: {
        modalDatas: function () {
          return $scope.modalDatas;
        }
      }
    });

    modal.result.then(function (data) {
      delete $scope.modalDatas.error;
    });

    $scope.modalDatas.ok = function () {
      let mails = null;
      if ($scope.modalDatas.notifyMails) {
        mails = $scope.modalDatas.notifyMails.split(',');
      }
      let childJobIds = null;
      if ($scope.modalDatas.childrenJobs.length > 0) {
        childJobIds = $scope.modalDatas.childrenJobs.map(r => r.id);
      }

      let job = {};
      angular.copy($scope.modalDatas, job);
      job.notifyMails = mails;
      job.childJobIds = childJobIds;

      if ($scope.modalDatas.mode == 'SIMPLE') {
        job.timestamp = new Date($scope.modalDatas.execDate).getTime();
        delete job.cron;
        delete job.initDelay;
        delete job.delay;
      } else if ($scope.modalDatas.mode == 'CRON') {
        delete job.initDelay;
        delete job.delay;
      } else if ($scope.modalDatas.mode == 'DELAY') {
        if ($scope.modalDatas.delayStr == null) {
          return false;
        }
        let delayArr = $scope.modalDatas.delayStr.split(',');
        if (delayArr.length != 2 || delayArr[0] == '' || delayArr[1] == '') {
          $scope.modalDatas.error = '延时填写有误';
          return false;
        }
        job.initDelay = delayArr[0];
        job.delay = delayArr[1];
        delete job.cron;
      }

      if ($scope.modalDatas.type == 'SCRIPT') {
        job.script = $scope.defaultScript;
        if ($scope.modalDatas.useExecutor) {
          job.group = {
            groupKey: $scope.modalDatas.groupKey
          };
        } else {
          delete job.group
        }
      } else {
        job.group = {
          jobKey: $scope.modalDatas.jobKey,
          groupKey: $scope.modalDatas.groupKey
        };
      }

      return $http.post('addJob', job).then(function (data) {
            if (data.data.success) {
              $scope.queryJobs();
            } else {
              $scope.modalDatas.error = data.data.message;
            }
            return data;
          },
          function (req) {
            $scope.modalDatas.error = req.data.message;
            return req;
          });
    };
  };

  $scope.triggleJob = function (id) {
    openConfirm($scope, $uibModal, "确定执行?", function (data) {

      return $http.post('triggerJob', {}, {params: {id: id}}).then(
          function (resp) {
            if (resp.data.success) {
              $scope.queryJobs();
            } else {
              $scope.modalDatas.error = resp.data.message;
            }
            return resp;
          },
          function (req) {
            $scope.modalDatas.error = req.data.message;
            return req;
          });

    });
  };

  $scope.pauseJob = function (id) {
    openConfirm($scope, $uibModal, "确定暂停?", function (data) {
      return $http.post('pauseJob', {id: id}, {params: {id: id}}).then(
          function (resp) {
            if (resp.data.success) {
              $scope.queryJobs();
            } else {
              $scope.modalDatas.error = resp.data.message;
            }
            return resp;
          },
          function (req) {
            $scope.modalDatas.error = req.data.message;
            return req;
          });
    });
  };

  $scope.resumeJob = function (id) {
    openConfirm($scope, $uibModal, "确定恢复?", function (data) {
      return $http.post('resumeJob', {id: id}, {params: {id: id}}).then(
          function (resp) {
            if (resp.data.success) {
              $scope.queryJobs();
            } else {
              $scope.modalDatas.error = resp.data.message;
            }
            return resp;
          },
          function (req) {
            $scope.modalDatas.error = req.data.message;
            return req;
          });
    });
  };

  $scope.removeJob = function (id) {
    openConfirm($scope, $uibModal, "确定删除?", function (data) {
      return $http.post('removeJob', {id: id}, {params: {id: id}}).then(
          function (resp) {
            if (resp.data.success) {
              $scope.queryJobs();
            } else {
              $scope.modalDatas.error = resp.data.message;
            }
            return resp;
          },
          function (req) {
            $scope.modalDatas.error = req.data.message;
            return req;
          });
    });
  };

  $scope.jumpToLogs = function (id) {
    $state.go("logs", {jobId: id});
  };

  $scope.jumpToScript = function (id) {
    $state.go("script", {jobId: id});
  };

  $scope.updateJob = function (id) {

    $scope.modalDatas = {};
    $scope.modalDatas.childrenJobs = [];
    $scope.modalDatas.extraSettings = $scope.extraSettings;
    $scope.modalDatas.translationTexts = $scope.translationTexts;

    $http.get('queryExecutors').then(function (resp) {
      let data = resp.data;
      if (data.success) {

        transferExecutor(data.data, $scope.modalDatas);

        if (data.data.length > 0) {
          $scope.modalDatas.groupKey = data.data[0].key;
          $scope.modalDatas.jobs = $scope.modalDatas.executorMap[$scope.modalDatas.groupKey];
          if (data.data[0].groups && data.data[0].groups.length > 0) {
            $scope.modalDatas.jobKey = data.data[0].groups[0].jobKey;
          }
        }
      }
    }).then(function () {
      $http.post('findJobInfoById', null, {params: {id: id}}).then(
          function (resp) {
            let data = resp.data;
            if (data.success && data.data) {
              let mails = null;
              if (data.data.notifyMails) {
                mails = data.data.notifyMails.join();
              }

              angular.extend($scope.modalDatas, data.data);
              $scope.modalDatas.preType = data.data.type;
              $scope.modalDatas.notifyMails = mails;

              if (data.data.mode == 'SIMPLE') {
                $scope.modalDatas.execDate = new Date(data.data.timestamp);
              } else if (data.data.mode == 'DELAY') {
                $scope.modalDatas.delayStr = data.data.initDelay + ","
                    + data.data.delay;
              }

              if (data.data.group) {
                $scope.modalDatas.groupKey = data.data.group.groupKey;
                $scope.modalDatas.jobs = $scope.modalDatas.executorMap[$scope.modalDatas.groupKey];
                if ($scope.modalDatas.type == 'SCRIPT') {
                  $scope.modalDatas.useExecutor = true;
                } else {
                  $scope.modalDatas.jobKey = data.data.group.jobKey;
                }
              }
            }
          }).then(function () {
        $http.get('queryAllJobs').success(function (data) {
          if (data.success) {
            $scope.modalDatas.jobInfos = [];
            data.data.forEach(r => {
              var obj = {id: r.id, label: r.name};
              if (r.id == id) {
                obj.disabled = true;
              }
              $scope.modalDatas.jobInfos.push(obj);
              if ($scope.modalDatas.childJobIds
                  && $scope.modalDatas.childJobIds.indexOf(r.id) > -1) {
                $scope.modalDatas.childrenJobs.push(obj);
              }
            });
          }
        });
      });
    });

    let modal = $uibModal.open({
      animation: true,
      ariaLabelledBy: 'modal-title',
      ariaDescribedBy: 'modal-body',
      templateUrl: "addJob.html",
      controller: 'appModalInstanceCtrl',
      controllerAs: '$ctrl',
      windowClass: 'modal-addJob',
      resolve: {
        modalDatas: function () {
          return $scope.modalDatas;
        }
      }
    });

    modal.result.then(function (data) {
      delete $scope.modalDatas.error;
    });

    $scope.modalDatas.ok = function () {
      let mails = null;
      if ($scope.modalDatas.notifyMails) {
        mails = $scope.modalDatas.notifyMails.split(',');
      }
      let childJobIds = null;
      if ($scope.modalDatas.childrenJobs.length > 0) {
        childJobIds = $scope.modalDatas.childrenJobs.map(r => r.id);
      }
      let job = {};
      angular.copy($scope.modalDatas, job);
      job.id = id;
      job.notifyMails = mails;
      job.childJobIds = childJobIds;

      if ($scope.modalDatas.mode == 'SIMPLE') {
        job.timestamp = new Date($scope.modalDatas.execDate).getTime();
        delete job.cron;
        delete job.initDelay;
        delete job.delay;
      } else if ($scope.modalDatas.mode == 'CRON') {
        delete job.initDelay;
        delete job.delay;
      } else if ($scope.modalDatas.mode == 'DELAY') {
        if ($scope.modalDatas.delayStr == null) {
          return false;
        }
        let delayArr = $scope.modalDatas.delayStr.split(',');
        if (delayArr.length != 2 || delayArr[0] == '' || delayArr[1] == '') {
          $scope.modalDatas.error = '延时填写有误';
          return false;
        }
        job.initDelay = delayArr[0];
        job.delay = delayArr[1];
        delete job.cron;
      }

      if (job.type == 'SCRIPT') {
        if ($scope.modalDatas.useExecutor) {
          job.group = {
            groupKey: $scope.modalDatas.groupKey
          };
        } else {
          delete job.group
        }
        if ($scope.modalDatas.preType != job.type) {
          job.script = $scope.defaultScript;
        }
      } else {
        job.group = {
          jobKey: $scope.modalDatas.jobKey,
          groupKey: $scope.modalDatas.groupKey
        };
      }
      return $http.post('updateJob', job).then(function (data) {
            if (data.data.success) {
              $scope.queryJobs();
            } else {
              $scope.modalDatas.error = data.data.message;
            }
            return data;
          },
          function (req) {
            $scope.modalDatas.error = req.data.message;
            return req;
          });
    };
  };

}

function logsController($rootScope, $scope, $http, $uibModal, $stateParams,
    $filter, $sce) {

  $rootScope.navActive = 2;

  $scope.pageIndex = 1;
  $scope.pageSize = 10;

  $scope.search = function () {
    let params = {
      jobId: $scope.jobId,
      pageIndex: $scope.pageIndex,
      pageSize: $scope.pageSize,
      groupKey: $scope.groupKey,
      jobKey: $scope.jobKey
    };
    $http.post('queryJobExecuteRecords', null, {params: params}).success(
        function (data) {
          if (data.success) {
            $scope.totalCount = data.data.totalCount;
            $scope.logs = data.data.items;
            if ($scope.logs) {
              $scope.logs.forEach(r => {
                $scope.popoverExecute(r);
              });
            }
          }
        });
  };

  $scope.popoverExecute = function (log) {
    if (!log.recordStatuses) {
      return;
    }
    let executeDetail = '', dispatchDetial = '';
    log.recordStatuses.forEach(r => {
      if (r.type == 0) {
        dispatchDetial += `<div class="form-group" style="text-align: center;"><label class="status-UNKNOWN">>>>任务调度<<<</label><div class="error-msg">${r.msg}</div></div>`;
      } else if (r.type == 1) {
        executeDetail += `<div class="form-group" style="text-align: center;"><label class="status-UNKNOWN">>>>任务执行<<<</label><div class="error-msg">${r.msg} [耗时${r.duration}ms]</div></div>`;
      } else if (r.type == 2) {
        dispatchDetial += `<div class="form-group" style="text-align: center;"><label class="status-FAIL">>>>失败重试<<<</label><div class="error-msg">${r.msg}</div></div>`;
      } else if (r.type == 3) {
        executeDetail += `<div class="form-group" style="text-align: center;"><label class="status-FAIL">>>>失败重试<<<</label><div class="error-msg">${r.msg} [耗时${r.duration}ms]</div></div>`;
      } else if (r.type == 5) {
        executeDetail += `<div class="form-group" style="text-align: center;"><label class="status-UNKNOWN">>>>子任务<<<</label><div class="error-msg">${r.msg}[<span class="status-${r.status}">${r.status}</span>]</div></div>`;
      }
    });
    log.dispatchDetail = $sce.trustAsHtml(dispatchDetial);
    log.executeDetail = $sce.trustAsHtml(executeDetail);
  };

  $scope.doFilter = function (value) {
    if (!$scope.searchFilter) {
      return true;
    }
    let projection = angular.copy(value);
    delete projection.id;
    return $filter('filter')([projection], $scope.searchFilter).length > 0;
  };

  $scope.filterJobs = function (value) {
    if (!value.group && ($scope.jobKey || $scope.groupKey)) {
      return false;
    }
    if ($scope.groupKey && value.group.groupKey != $scope.groupKey) {
      return false;
    }
    return !($scope.jobKey && value.group.jobKey != $scope.jobKey);

  };

  $http.get('queryExecutors').success(function (data) {
    if (data.success) {
      transferExecutor(data.data, $scope);
    }
    $http.get('queryAllJobs').success(function (dd) {
      if (dd.success) {
        $scope.jobInfos = dd.data;
        $scope.jobMap = {};
        for (let i in $scope.jobInfos) {
          $scope.jobMap[$scope.jobInfos[i].id] = $scope.jobInfos[i];
        }
      }
      $scope.jobId = $stateParams.jobId;
      $scope.search();
    });
  });

  $scope.executorChange = function () {
    $scope.jobKey = "";
    if ($scope.groupKey) {
      $scope.jobs = $scope.executorMap[$scope.groupKey];
    }
  };

  $scope.removeJobLog = function () {
    if (!$scope.jobId) {
      openConfirm($scope, $uibModal, '请选择要删除日志的任务');
      return;
    }
    openConfirm($scope, $uibModal,
        '确定要删除[' + $scope.jobMap[$scope.jobId].name + ']的日志？', function () {
          return $http.post('removeJobRecords', {},
              {params: {jobId: $scope.jobId}}).then(function (resp) {
                if (resp.data.success) {
                  $scope.search();
                } else {
                  $scope.modalDatas.error = resp.data.message;
                }
                return resp;
              },
              function (req) {
                $scope.modalDatas.error = req.data.message;
                return req;
              });
        });
  };
}

function scriptController($scope, $stateParams, $state, $uibModal, $http) {

  let myTextarea = document.getElementById('editor');

  $scope.jobId = $stateParams.jobId;

  $scope.queryVersions = function () {
    $http.post('queryJobScripts', null,
        {params: {jobId: $stateParams.jobId}}).then(function (resp) {
      let data = resp.data;
      if (data.success && data.data) {
        $scope.scriptList = data.data;
        $scope.scriptMap = new Map();
        data.data.forEach(r => $scope.scriptMap.set(r.id, r));
      }
    });
  };

  $http.post('findJobInfoById', null, {params: {id: $stateParams.jobId}}).then(
      function (resp) {
        let data = resp.data;
        if (data.success && data.data) {
          myTextarea.value = data.data.script;
          $scope.queryVersions();
        }
      }).then(function (resp) {
    $scope.codeMirrorEditor = CodeMirror.fromTextArea(myTextarea, {
      mode: "text/x-java",
      lineNumbers: true
    });
  });

  $scope.switchScript = function (id) {
    let script = $scope.scriptMap.get(id);
    $scope.codeMirrorEditor.doc.setValue(script.script);
    $scope.version = script.version;
  };

  $scope.save = function () {
    if (!$scope.version) {
      $scope.versionError = true;
      return;
    }

    $scope.versionError = false;

    let script = $scope.codeMirrorEditor.doc.getValue();

    $http.post("addJobScript",
        {jobId: $scope.jobId, script: script, version: $scope.version}).then(
        function (resp) {
          let data = resp.data;
          if (data.success) {
            openConfirm($scope, $uibModal, data.data);
          } else {
            openConfirm($scope, $uibModal, data.message);
          }
          $scope.queryVersions();
        },
        function (XMLHttpRequest, textStatus, errorThrown) {
          $scope.modalDatas.error = errorThrown;
        });
  };
}

function statisticsController($scope, $http, $filter) {
  $scope.option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#999'
        }
      }
    },
    toolbox: {
      feature: {
        magicType: {show: true, type: ['line', 'bar']},
        restore: {show: true},
        saveAsImage: {show: true}
      },
      right: '10%'
    },
    legend: {
      data: ['调度成功', '调度失败', '执行成功', '执行失败']
    },
    xAxis: [{
      type: 'category',
      axisPointer: {
        type: 'shadow'
      },
      data: []
    }],
    yAxis: [{
      type: 'value'
    }],
    series: [{
      name: '调度成功',
      type: 'bar',
      data: []
    },
      {
        name: '调度失败',
        type: 'bar',
        data: []
      },
      {
        name: '执行成功',
        type: 'line',
        showAllSymbol: true,
        data: []
      },
      {
        name: '执行失败',
        type: 'line',
        showAllSymbol: true,
        data: []
      }]
  };

  const today = new Date(), sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  $scope.begin = {opened: false, value: sevenDaysAgo};
  $scope.end = {opened: false, value: today};

  $scope.dailyReport = echarts.init(document.getElementById('dailyReport'));

  $scope.search = function () {
    let params = {
      begin: $filter('date')($scope.begin.value, 'yyyy-MM-dd'),
      end: $filter('date')($scope.end.value, 'yyyy-MM-dd')
    };
    $http.post('queryJobStatistic', null, {params: params}).success(
        function (data) {
          if (data.success) {
            $scope.option.xAxis[0].data = data.data.statisticDays;
            $scope.option.series[0].data = data.data.successDispatches;
            $scope.option.series[1].data = data.data.failDispatches;
            $scope.option.series[2].data = data.data.successExecutions;
            $scope.option.series[3].data = data.data.failExecutions;
            $scope.dailyReport.setOption($scope.option);
            $scope.totalJobs = data.data.totalJobs;
            $scope.totalExecutors = data.data.totalExecutors;
            $scope.totalDispatches = data.data.totalDispatches;
            $scope.totalRunningExecutions = data.data.totalRunningExecutions;
          }
        });
  };

  $scope.search();
}

function openConfirm($scope, $uibModal, msg, ok) {
  $scope.modalDatas = {
    title: "提示信息",
    msg: msg,
    ok: ok
  };
  let modal = $uibModal.open({
    animation: true,
    ariaLabelledBy: 'modal-title',
    ariaDescribedBy: 'modal-body',
    templateUrl: "modal.html",
    controller: 'appModalInstanceCtrl',
    controllerAs: '$ctrl',
    windowClass: 'modal-confirm',
    resolve: {
      modalDatas: function () {
        return $scope.modalDatas;
      }
    }
  });

  modal.result.then(function (data) {
    delete $scope.modalDatas.error;
  });

}

function transferExecutor(data, modalDatas) {
  const map = new Map();
  data.forEach(r => {
    if (!map.has(r.key)) {
      map.set(r.key, new Map());
    }
    if (r.groups) {
      r.groups.forEach(g => map.get(r.key).set(g.id, g));
    }
  });

  modalDatas.executorMap = {};
  for (let [key, value] of map) {
    modalDatas.executorMap[key] = [];
    for (let [k, v] of value) {
      modalDatas.executorMap[key].push(v);
    }
  }

}

