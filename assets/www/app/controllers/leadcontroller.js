'use strict';

function LeadController($scope, $state, $stateParams, $ionicModal, $ionicLoading, LeadService, DeviceContactService, DataOperationService, CustomObjectService){
	//+++++++++++++++++++++VARIABLES
	$ionicModal.fromTemplateUrl('confirm.html', {
	    scope: $scope,
	    animation: 'slide-in-up'
	  }).then(function(modal) {
	    $scope.confirmationDialog = modal;
	  });
	$scope.oldParams = $stateParams;
	$scope.inDevice = $scope.$eval($stateParams.inDevice);
	$scope.inSalesforce = $scope.$eval($stateParams.inSalesforce);
	$scope.isNew = !$scope.inDevice && !$scope.inSalesforce;
	$scope.statusOptions = [];
	$scope.lead = {
			id: null,
			ctid: null,
			fName: '',
			lName: '',
			phone: '',
			company: '',
			status: 'Open - Not Contacted'
	};
	$scope.leadObj = new LeadService.Lead();

	//+++++++++++++++++++++FUNCTIONS

	$scope.callphone = function(){
		if($scope.lead.phone !== null){
			document.location.href = 'tel:' + $scope.lead.phone;
		}
	};

	$scope.addToDevice = function(){
		document.addEventListener("resume", appResumed, false);
		cordova.exec(
					function(winParam) {alert('success');}, 
					function(error) {alert('fail');}, 
					"OpenAppPlugin",
                 	"createcontact", 
                 	[{
                 		firstname: $scope.lead.fName,
                 		lastname: $scope.lead.lName,
                 		phone: $scope.lead.phone,
                 		company: $scope.lead.company
                 	}]);
	};

	$scope.addThroughQRCode = function(){
		document.addEventListener("resume", appResumed, false);
		cordova.exec(function (result) {
			if(!result.cancelled){
				VCF.parse(result.text, function(vcard) {
				  LOG('FNAME', vcard.n['given-name'][0]);
				  LOG('LNAME', vcard.n['family-name'][0]);
				  LOG('TEL', vcard.tel[0].value);
				  LOG('ORG', vcard.org[0]['organization-name']);			  
				  LOG('ALL', vcard);

				  $scope.lead.fName = vcard.n['given-name'][0];
				  $scope.lead.lName = vcard.n['family-name'][0];
				  $scope.lead.phone = vcard.tel[0].value;
				  $scope.lead.company = vcard.org[0]['organization-name'];
				  $scope.$apply();
				});
			}
	    }, 
	    function (error) {
	        alert('Scanning failed: ' + error);
	    },
	    'BarcodeScanner',
	    'scan',
	    []);


		/*
		cordova.exec(function (resultArray) {
	           VCF.parse(resultArray[0], function(vcard) {
				  LOG('FNAME', vcard.n['given-name'][0]);
				  LOG('LNAME', vcard.n['family-name'][0]);
				  LOG('TEL', vcard.tel[0].value);
				  LOG('ORG', vcard.org[0]['organization-name']);			  
				  LOG('ALL', vcard);
				});

	      }, 
	      errorfunc,
	      "ScanditSDK", 
	      "scan", 
	      ["tGCpePumEeOAg+lBdoEDxzYF5oX0hzpII/ZK4rwcGIQ",{"beep": true,
	                              "1DScanning" : true,
	                              "2DScanning" : true}]);*/
	};

	$scope.addToSalesforce = function(){
		$scope.edit();
	};

	$scope.showOnDevice = function(){
		document.addEventListener("resume", appResumed, false);
		cordova.exec(
					function(winParam) {console.log('SHOW ON DEVICE -- SUCCESS -- ' + JSON.stringify(winParam));}, 
					function(error) {console.log('SHOW ON DEVICE -- ERROR -- ' + JSON.stringify(error));}, 
					"OpenAppPlugin",
                 	"displaycontact", 
                 	[{
                 		id: $scope.lead.ctid
                 	}]);
	};

	$scope.edit = function(){
		var current = $state.current;        	

        $ionicLoading.show({
			template: '<i class="fa fa-cog fa-spin"></i>',
			animation: 'fade-in',
			showBackdrop: true,
			maxWidth: 200,
			showDelay: 100
		});

		$scope.leadObj.set('FirstName', $scope.lead.fName);
		$scope.leadObj.set('LastName', $scope.lead.lName);
		$scope.leadObj.set('Phone', $scope.lead.phone);
		$scope.leadObj.set('Company', $scope.lead.company);
		$scope.leadObj.set('Status', $scope.lead.status);

		if(!$scope.isNew && !($scope.inDevice && !$scope.inSalesforce)){
			//Regular edit
			LOG('EDIT LEAD', $scope.leadObj);
			$scope.leadObj.set('Id', $scope.lead.id);		
			DataOperationService.save($scope.leadObj,
										true, 
										function(){
											$ionicLoading.hide();
											$state.transitionTo(current, $scope.oldParams, { reload: true, inherit: true, notify: true });
										},
										function(){
											$ionicLoading.hide();
										});
		}else{
			//Create or Create from device contact
			DataOperationService.create($scope.leadObj, function(record){
				$ionicLoading.hide();
				$scope.oldParams.leadId = record.get('Id');
				$scope.oldParams.inSalesforce = true;
				$state.transitionTo(current, $scope.oldParams, { reload: true, inherit: true, notify: true });
			},
			function(err){
				LOG('LEAD EDIT', err);
			});			
		}			       
	};

	$scope.delete = function(){
		$scope.confirmationDialog.show();
		//$scope.confirmDelete(true); //allow for confirmation dialog		
	};

	 $scope.$on('modal.hide', function() {
		$scope.confirmationDialog.remove();
	  });

	$scope.confirmDelete = function(isSure){
		$scope.confirmationDialog.hide();
		if(isSure){			
			DataOperationService.destroy($scope.leadObj, function(record){
				$state.transitionTo('home');
			});	
		}
	};

	//+++++++++++++++++++++ON CONTROLLER LOAD

	var init = function(){
		if($scope.inSalesforce){
			
			$scope.leadObj = LeadService.getLead($scope.oldParams.leadId);

			LOG('GETTING SF CONTACT', $scope.leadObj);

			$scope.lead = {
				id: $scope.leadObj.get('Id'),
				ctid: $scope.oldParams.ctid,
				fName: $scope.leadObj.get('FirstName'),
				lName: $scope.leadObj.get('LastName'),
				phone: $scope.leadObj.get('Phone'),
				company: $scope.leadObj.get('Company'),
				status: $scope.leadObj.get('Status')
			};
		}else{
			if($scope.inDevice){
				DeviceContactService.getDeviceContacts(function(contacts){
					contacts.forEach(function(contact){
						if(contact.id == $scope.oldParams.ctid){
							$scope.contactObj = contact;
							var phone = null;
							var org = null;
							if($scope.contactObj.phoneNumbers && $scope.contactObj.phoneNumbers[0] !== null){
								phone = $scope.contactObj.phoneNumbers[0].value;
							}
							if($scope.contactObj.organizations && $scope.contactObj.organizations[0] !== null){
								org = $scope.contactObj.organizations[0].name;
							} 
							$scope.lead = {
								id: null,
								ctid: $scope.contactObj.id,
								fName: $scope.contactObj.name.givenName,
								lName: $scope.contactObj.name.familyName,
								phone: phone,
								company: org,
								status: 'Open - Not Contacted'
							};
							$scope.$apply();
					}
					});
				},
				function(err){
					console.log('ERR -- ' + JSON.stringify(err));
				});	
			}	
		}
	};

	var describeStatusOptions = function(data){
		LOG('DISPLAY STATUSOPTIONS', data);
		data.currentPageOrderedEntries.forEach(function(item){			
			$scope.statusOptions.push({label: item.label, value: item.value});					
		});
	};

	var checkContactExists = function(devicecontacts){
		if(devicecontacts.length === 0){
			LOG('NO CONTACTS FOUND', devicecontacts);
			$scope.inDevice = false;
			$scope.lead.ctid = null;
		}else{
			devicecontacts.forEach(function(contact){
				LOG('CHECK CONTACT EXISTS', contact);
				if(contact.displayName == $scope.lead.fName + ' ' +  $scope.lead.lName){
					LOG('CONTACT EXISTS IN DEVICE', contact);
					//Lead in device as contact
					$scope.inDevice = true;
					$scope.lead.ctid = contact.id;
				}else{
					LOG('CONTACT DOES NOT EXIST IN DEVICE', contact);
					$scope.inDevice = false;
					$scope.lead.ctid = null;
				}
			});		
		}
	};

	var appResumed = function(){
		LOG('RESUMED', $scope.isNew);
		LOG('RESUMED', $scope.lead);
		if(!$scope.isNew){
			var current = $state.current;
	        var params = $scope.oldParams;
	        $state.transitionTo(current, params, { reload: true, inherit: true, notify: true });
	    }
	    document.removeEventListener("resume", appResumed, false);
	};

	init();
	LOG('STATEPARAMS BEFORE DEVICECHECK', $scope.oldParams);
	if($scope.oldParams.leadId !== null){
		DeviceContactService.getDeviceContacts(checkContactExists, function(err){}, $scope.lead.lName);
	}
	CustomObjectService.getStatusOptions(describeStatusOptions);	
}

ControllerModule.controller('LeadController', ['$scope', '$state', '$stateParams', '$ionicModal', '$ionicLoading', 'LeadService', 'DeviceContactService', 'DataOperationService', 'CustomObjectService', LeadController]);