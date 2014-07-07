'use strict';

function TopLevelController($scope, $state, DataOperationService, CustomObjectService){
	$scope.settings = {
		includeContacts: true
	};

	cordova.exec(function(val){ $scope.settings.includeContacts = (val === 'true');},
				 function(err){LOG('READ_SETTINGS', err);},
				 'PreferencesPlugin',
				 'read_or_create',
				 [{name: 'IncludeContacts', value:"true"}]);

	$scope.editSettings = function(name, value){
		cordova.exec(function(){/*Success*/},
					 function(err){LOG('SETTINGS', err);},
					 'PreferencesPlugin',
					 'store',
					 [{name: name, value: value.toString()}]);
	};

	$scope.toSettings = function(){
		$state.transitionTo('settings');
	};

	$scope.logout = function(){
		cordova.require("salesforce/plugin/oauth").logout();
	};

	$scope.goToConflicts = function(){
		$state.transitionTo('conflict');
	};

	$scope.goHome = function(){
		$state.transitionTo('home');
	};

	$scope.$watch( function () { return {conflictCount: DataOperationService.getConflicts().getLength()} }, function (data) {
	    	$scope.conflictCount = data.conflictCount;
	}, true);

	$scope.isOnline = OfflineTracker.isOnline();
	OfflineTracker.addToOnlineEvent(function(){$scope.isOnline = true; $scope.$apply();});
	OfflineTracker.addToOfflineEvent(function(){$scope.isOnline = false; $scope.$apply();});
	CustomObjectService.initStatusOptions();
}

ControllerModule.controller('TopLevelController', ['$scope', '$state', 'DataOperationService', 'CustomObjectService', TopLevelController]);