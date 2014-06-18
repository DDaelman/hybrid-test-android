/*
* THIS EXTENSION TO SMARTSYNC USES THE SALESFORCE BULK API TO STORE MANY RECORDS AT ONCE ON THE SERVER
* CURRENTLY LIMITED TO ONE BATCH (= 10000 RECORDS)
* AN INTERNET CONNECTION IS REQUIRED
* SMARTSYNC.JS MUST BE LOADED BEFORE THIS FILE
*/

'use strict';

	//Generic log messages
	var LOG = function(preamble, object){
		var date = new Date();
	    var formatted = '[' + date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear() + ' - ' +  date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() + ']';

		console.log('DEBUG -- ' + formatted + ' -- ' + preamble + ' -- ' + JSON.stringify(object));
	};

    function CSVToArray( strData, strDelimiter ){
        // Check to see if the delimiter is defined. If not,
        // then default to comma.
        strDelimiter = (strDelimiter || ","); 
        // Create a regular expression to parse the CSV values.
        var objPattern = new RegExp(
            (
                // Delimiters.
                "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
 
                // Quoted fields.
                "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
 
                // Standard fields.
                "([^\"\\" + strDelimiter + "\\r\\n]*))"
            ),
            "gi"
            ); 
        // Create an array to hold our data. Give the array
        // a default empty first row.
        var arrData = [[]]; 
        // Create an array to hold our individual pattern
        // matching groups.
        var arrMatches = null; 
        // Keep looping over the regular expression matches
        // until we can no longer find a match.
        while (arrMatches = objPattern.exec( strData )){ 
            // Get the delimiter that was found.
            var strMatchedDelimiter = arrMatches[ 1 ]; 
            // Check to see if the given delimiter has a length
            // (is not the start of string) and if it matches
            // field delimiter. If id does not, then we know
            // that this delimiter is a row delimiter.
            if (
                strMatchedDelimiter.length &&
                (strMatchedDelimiter != strDelimiter)
                ){ 
                // Since we have reached a new row of data,
                // add an empty row to our data array.
                arrData.push( [] ); 
            } 
            // Now that we have our delimiter out of the way,
            // let's check to see which kind of value we
            // captured (quoted or unquoted).
            if (arrMatches[ 2 ]){ 
                // We found a quoted value. When we capture
                // this value, unescape any double quotes.
                var strMatchedValue = arrMatches[ 2 ].replace(
                    new RegExp( "\"\"", "g" ),
                    "\""
                    ); 
            } else { 
                // We found a non-quoted value.
                var strMatchedValue = arrMatches[ 3 ]; 
            } 
            // Now that we have our value string, let's add
            // it to the data array.
            arrData[ arrData.length - 1 ].push( strMatchedValue );
        }
        // Return the parsed data.
        return( arrData );
    }

function createCORSRequest(method, url) {
	var xhr = new XMLHttpRequest();
	if ('withCredentials' in xhr) {
	    // Check if the XMLHttpRequest object has a "withCredentials" property.
	    // "withCredentials" only exists on XMLHTTPRequest2 objects.
	    xhr.open(method, url, true);
	} else if (typeof XDomainRequest != 'undefined') {
	    // Otherwise, check if XDomainRequest.
	    // XDomainRequest only exists in IE, and is IE's way of making CORS requests.
	    xhr = new XDomainRequest();
	    xhr.open(method, url);
	} else {
	    // Otherwise, CORS is not supported by the browser.
		xhr = null;
	}
	LOG('CREATE XHR', {});
	return xhr;
}

if(!Force){
	LOG('SMARTSYNC-BULK -- SMARTSYNC BASE NOT LOADED - INCLUDE SMARTSYNC.JS BEFORE THIS FILE', {});
}else{
	_.extend(Force.StoreCache.prototype, {
		saveAllAndSync: function(records, mergeMode, batchresultCB, conflictCB){ //ADD CACHEFORORIGINALS MANUALLY FROM DATAOPERATIONSERVICE CALL
			LOG('SMARTSYNC-BULK -- SAVE AND SYNC ALL START', records);
			this.bulkSync(records, mergeMode, {
				success: function(data){ LOG('SUCCESS IN MERGING', data); },
				error: function(conflict){ conflictCB(conflict); }
			});
			var loader = new BulkDataLoader();
			loader.saveAll(records, batchresultCB); //Saving to SF
			var jsonRecords = [];
			records.forEach(function(rec){
				jsonRecords.push(rec.toJSON());
			});
			this.saveAll(jsonRecords, false);
		},

		/*
		* This is a function based on syncRemoteObjectDetectConflict in the original SmartSync file
		* It has been altered to return the live version of the record that gets passed in as a parameter
		* instead of querying SF once for every record. 
		* To get this parameter, a list of live records is fetched by extracting all Ids from the records to process and querying SF (with SOQL)
		* with these Ids (eg. SELECT fields FROM type WHERE Id IN ( list_of_ids ) ). The result of this query is then iterated over and this function
		* is called for every record. See bulkSync for the implementation
		* method: 			insert/update/delete/...
		* record: 			The live record 
		* id: 				The record Id
		* attributes: 		The record attributes
		* fieldlist: 		List of fields to handle based on the operation
		* cache: 			The StoreCache containing the record
		* cacheMode: 		Behaviour for caching
		* cacheForOriginals:The StoreCache containing the original cached records
		* mergeMode: 		Behaviour for detecting conflicts 
		*/
		detectConflicts: function(method, record, id, attributes, fieldlist, cache, cacheMode, cacheForOriginals, mergeMode) {
        // To keep track of whether data was read from cache or not
        var info = {};

        var serverRetrieve = function() {
            return record;
        };

        var Promise = function() {
        	this.then = function(){
        		return record.toJSON();
        	};
        }; // Empty Promise ;) 

        var syncRemoteObject = function(attributes) {
            return Force.syncRemoteObject(method, id, attributes, fieldlist, cache, cacheMode, info, function(method, id, attributes, fieldlist){return new Promise();});
        };

        // Original cache required for conflict detection
        if (cacheForOriginals === null) {
            syncRemoteObject(attributes);
        }

        // Original cache actions -- does nothing for local actions
        var cacheForOriginalsRetrieve = function(data) {
            return cacheForOriginals.retrieve(id);
        };

        var cacheForOriginalsSave = function(data) {
            return (cacheMode == Force.CACHE_MODE.CACHE_ONLY || data.__local__ /* locally changed: don't write to cacheForOriginals */
                    || (method == "read" && cacheMode == Force.CACHE_MODE.CACHE_FIRST && info.wasReadFromCache) /* read from cache: don't write to cacheForOriginals */)
                ? data
                : cacheForOriginals.save(data);
        };

        var cacheForOriginalsRemove = function() {
            return (cacheMode == Force.CACHE_MODE.CACHE_ONLY
                    ? null : cacheForOriginals.remove(id));
        };

        // Given two maps, return keys that are different
        var identifyChanges = function(attrs, otherAttrs) {
            return _.filter(_.intersection(fieldlist, _.union(_.keys(attrs), _.keys(otherAttrs))),
                            function(key) {
                                return (attrs[key] || "") != (otherAttrs[key] || ""); // treat "", undefined and null the same way
                            });
        };

        // When conflict is detected (according to mergeMode), the promise is failed, otherwise syncRemoteObject() is invoked
        var checkConflictAndSync = function() {
            var originalAttributes;

            // Merge mode is overwrite or local action or locally created -- no conflict check needed
            if (mergeMode == Force.MERGE_MODE.OVERWRITE || mergeMode == null /* no mergeMode specified means overwrite */
                || cacheMode == Force.CACHE_MODE.CACHE_ONLY
                || (cache != null && cache.isLocalId(id)))
            {
                return syncRemoteObject(attributes);
            }

            // Otherwise get original copy, get latest server and compare
            return cacheForOriginalsRetrieve()
                .then(function(data) {
                    originalAttributes = data;
                    return (originalAttributes == null ? null /* don't waste time going to server */: serverRetrieve());
                })
                .then(function(remoteAttributes) {
                    var shouldFail = false;

                    if (remoteAttributes == null || originalAttributes == null) {
                        return syncRemoteObject(attributes);
                    }
                    else {
                        var localChanges = identifyChanges(originalAttributes, attributes);
                        var localVsRemoteChanges = identifyChanges(attributes, remoteAttributes);
                        var remoteChanges = identifyChanges(originalAttributes, remoteAttributes);
                        var conflictingChanges = _.intersection(remoteChanges, localChanges, localVsRemoteChanges);
                        var nonConflictingRemoteChanges = _.difference(remoteChanges, conflictingChanges);

                        switch(mergeMode) {
                        case Force.MERGE_MODE.MERGE_ACCEPT_YOURS:     shouldFail = false; break;
                        case Force.MERGE_MODE.MERGE_FAIL_IF_CONFLICT: shouldFail = conflictingChanges.length > 0; break;
                        case Force.MERGE_MODE.MERGE_FAIL_IF_CHANGED:  shouldFail = remoteChanges.length > 0; break;
                        }
                        if (shouldFail) {
                            var conflictDetails = {base: originalAttributes, theirs: remoteAttributes, yours:attributes, remoteChanges:remoteChanges, localChanges:localChanges, conflictingChanges:conflictingChanges};
                            return $.Deferred().reject(conflictDetails);
                        }
                        else {
                            var mergedAttributes = _.extend(attributes, _.pick(remoteAttributes, nonConflictingRemoteChanges));
                            return syncRemoteObject(mergedAttributes);
                        }
                    }
                });
	        };

	        var promise = null;
	        switch(method) {
	        case "create": promise = cacheForOriginalsSave(); break;
	        case "read":   promise = cacheForOriginalsSave(); break;
	        case "update": promise = checkConflictAndSync().then(cacheForOriginalsSave); break;
	        case "delete": promise = checkConflictAndSync().then(cacheForOriginalsRemove); break;
	        }

	        // Done
	        return promise;
	    },

	    /* 
	    * This is the utility function that sets up the call for checking conflicts
	    * records :    	List of records to be created/updated/deleted 
	    * mergeMode :  	Same as in regular saving, determines behaviour for record handling
	    * callbacks :  	Object with success and error properties. These functions are called depending on the result of the conflict checking
	    * 				Currently only the error function can be set by the user, as this will contain the conflict information when necessary
	    */
		bulkSync: function(records, mergeMode, callbacks){	
			LOG('SMARTSYNC-BULK -- CONFLICT DETECTION START', {});	

			var ids = {};
			var types = [];
			var recordsByType = {};
			var fieldlist = {};
			var serverOriginals = {};
			records.forEach(function(record){
				if(!ids[record.sobjectType]){
					ids[record.sobjectType] = [];
					fieldlist[record.sobjectType] = [];
					serverOriginals[record.sobjectType] = [];
					recordsByType[record.sobjectType] = [];
					types.push(record.sobjectType);					
				}
				ids[record.sobjectType].push(record.get('Id'));
				recordsByType[record.sobjectType].push(record);

				var fields = record.fieldlist('read');
				fieldlist[record.sobjectType] = fields;
			});
			var that = this;
			types.forEach(function(type){

				Force.forcetkClient.query('SELECT ' + fieldlist[type] + ' FROM ' + type + ' WHERE Id IN (\'' + ids[type].join('\',\'') + '\')',
									function(results){
										LOG('SMARTSYNC-BULK -- GOT RECORDS FROM SERVER', results);
										serverOriginals[type] = results.records;
										recordsByType[type].forEach(function(record){
											var method = 'read';
											if(record.get('__locally_created__')){
												//Insert
												method = 'insert';
											}
											if(record.get('__locally_updated__')){
												//Update
												method = 'update';
											}
											if(record.get('__locally_deleted__')){
												//Delete
												method = 'delete';
											}

											that.detectConflicts(	method,
																	record,
																	record.get('Id'),
																	record.attributes,
																	record.fieldlist(method),
																	record.cache(),
																	record.cacheMode(method),
																	record.cacheForOriginals(),
																	serverOriginals[record.sobjectType],
																	mergeMode).done(callbacks.success).fail(callbacks.error);
										});
									},
									function(err){
										LOG('SMARTSYNC-BULK -- ERROR GETTING RECORDS FROM SERVER', err);
									});
			});
		}
	});
	
}

var BulkJob = function(operation, objectType){
	this.operation = operation;
	this.objectType = objectType;
	this.jobId = '';
	this.batches = [];
	this.failedRecords = [];
	this.processedRecords = [];

	this.create = function(onCreated){
		var that = this;
		var template = '<?xml version="1.0" encoding="UTF-8"?>' +
						'<jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">' +
						    '<operation>' + this.operation + '</operation>' +
						    '<object>' + this.objectType + '</object>' +
						    '<contentType>CSV</contentType>' +
						'</jobInfo>';

		LOG('SMARTSYNC-BULK -- CREATE JOB START', Force.forcetkClient.impl);

		var destination = Force.forcetkClient.impl.instanceUrl + '/services/async/30.0/job';
		var xhr = createCORSRequest('POST', destination);
		LOG('SMARTSYNC-BULK -- CREATE JOB REQUEST', destination);
		xhr.setRequestHeader('Content-Type', 'application/xml; charset=UTF-8');
		xhr.setRequestHeader('X-SFDC-Session', Force.forcetkClient.impl.sessionId);
		xhr.onload = function(){
			var response = xhr.responseXML;
			that.jobId = response.getElementsByTagName('id')[0].childNodes[0].nodeValue;
			LOG('SMARTSYNC-BULK -- CREATE JOB RESPONSE', that.jobId);
			onCreated();
		};
		xhr.send(template);
	};

	this.addBatch = function(recordsCSV){
		this.batches.push(recordsCSV);
	};

	this.runBatch = function(recordsCSV){
		LOG('SMARTSYNC-BULK -- ADD BATCH START', recordsCSV);
		var that = this;
		var destination = Force.forcetkClient.impl.instanceUrl + '/services/async/30.0/job/' + this.jobId + '/batch';
		var xhr = createCORSRequest('POST', destination);
		xhr.setRequestHeader('Content-Type', 'text/csv; charset=UTF-8');
		xhr.setRequestHeader('X-SFDC-Session', Force.forcetkClient.impl.sessionId);
		xhr.onload = function(){
			//Store ids for future monitoring
			var response = xhr.responseXML;		
			var batchId = response.getElementsByTagName('id')[0].childNodes[0].nodeValue;	
			LOG('SMARTSYNC-BULK -- ADD BATCH REPONSE', batchId);
		};
		xhr.send(recordsCSV);
	};

	this.close = function(){
		LOG('CLOSE JOB', {});
		var that = this;
		var template= '<?xml version="1.0" encoding="UTF-8"?>'+
						'<jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">'+
						  '<state>Closed</state>'+
						'</jobInfo>';

		var destination = Force.forcetkClient.impl.instanceUrl + '/services/async/30.0/job/' + this.jobId;
		var xhr = createCORSRequest('POST', destination);
		xhr.setRequestHeader('Content-Type', 'application/xml; charset=UTF-8');
		xhr.setRequestHeader('X-SFDC-Session', Force.forcetkClient.impl.sessionId);
		xhr.onload = function(){
			var response = xhr.responseXML;
			that.jobId = response.getElementsByTagName('id')[0].childNodes[0].nodeValue;
			LOG('SMARTSYNC-BULK -- CLOSE JOB REPONSE', that.jobId);
		};
		xhr.send(template);
	};

	this.run = function(batchresultCB){		
		var that = this;		
		this.create(function(){							//Create Job on SF
			that.batches.forEach(function(CSVBatch){	
				that.runBatch(CSVBatch);				//Start adding batches when Job created
			});						
			that.checkBatchStatus(batchresultCB);					//Monitor status and close when batches processed
		});
	};

	this.checkBatchStatus = function(batchresultCB){
		var that = this;
		var destination = Force.forcetkClient.impl.instanceUrl + '/services/async/30.0/job/' + this.jobId + '/batch';
		var xhr = createCORSRequest('GET', destination); //GET Method very important, otherwise service assumes a batch is being created, not read
		xhr.setRequestHeader('X-SFDC-Session', Force.forcetkClient.impl.sessionId);
		xhr.onload = function(){
			var response = xhr.responseXML;		
			var batches = response.getElementsByTagName('batchInfo');
			var processedCount = 0;

			for (var i = 0; i < batches.length; ++i) {
			    var status = batches.item(i).getElementsByTagName('state')[0].childNodes[0].nodeValue;
				var id = batches.item(i).getElementsByTagName('id')[0].childNodes[0].nodeValue;
				if(status === 'Failed'){
					LOG('SMARTSYNC-BULK -- BATCH FAILED', id);
					processedCount++;
				}
				if(status === 'Completed'){
					LOG('SMARTSYNC-BULK -- BATCH COMPLETED', id);
					that.checkBatchRecords(id, batchresultCB);
					processedCount++;
				}
			}
			//Probably not the most efficient use of API call limits, though batch counts should never be high anyway
			if(processedCount != that.batches.length){
				that.checkBatchStatus(batchresultCB);
			}else{
				that.close();				
			}
		};
		xhr.send();
	};

	this.checkBatchRecords = function(id, batchresultCB){
		var that = this;
		var destination = Force.forcetkClient.impl.instanceUrl + '/services/async/30.0/job/' + this.jobId + '/batch/' + id + '/result';
		var xhr = createCORSRequest('GET', destination);
		xhr.setRequestHeader('Content-Type', 'text/csv; charset=UTF-8');
		xhr.setRequestHeader('X-SFDC-Session', Force.forcetkClient.impl.sessionId);
		xhr.onload = function(){
			//CSV batches receive CSV responses, so no XML this time
			var response = xhr.responseText;		
			var CSVArray = CSVToArray(response);
			CSVArray.forEach(function(row){
				var lastIdx = row.length - 1;
				if(row[lastIdx] && row[lastIdx] !== '' && row[lastIdx] !== 'Error'){ 
					that.failedRecords.push({id: row[0], error: row[lastIdx]});
					LOG('SMARTSYNC-BULK -- RECORD ERROR', row[0]);
				}else{
					if(row[0] !== 'Id' && row[0] !== ''){
						that.processedRecords.push(row[0]);
						LOG('SMARTSYNC-BULK -- RECORD SUCCESS', row[0]);
					}
				}
			});
			batchresultCB({
					status: 'completed',
					failed: that.failedRecords,
					succeeded: that.processedRecords
				});
		};
		xhr.send();
	};
};

var BulkDataLoader = function(){
	var Jobs = {
		inserts: {},
		updates: {},
		deletions: {}
	};

	var CSV = {
		inserts: {},
		updates: {},
		deletions: {}
	};

	this.saveAll = function(records, batchresultCB){
		//Records can contain data for multiple object types
		batchresultCB({
			status: 'init',
			failed: [],
			succeeded: []
		});
		this.separateJobs(records);
		
		batchresultCB({
			status: 'processing',
			failed: [],
			succeeded: []
		});
		this.distributeBatches(batchresultCB);		
	};

	this.separateJobs = function(records){
		var that = this;

		records.forEach(function(record){
			if(record.get('__locally_created__')){
				//Insert
				if(!Jobs.inserts[record.sobjectType]){
					Jobs.inserts[record.sobjectType] = new BulkJob('insert', record.sobjectType);
					CSV.inserts[record.sobjectType] = record.fieldlist('insert').join(','); //Header
				}
				CSV.inserts[record.sobjectType] += '\n' + that.toCSV(record);
			}
			if(record.get('__locally_updated__')){
				//Update
				if(!Jobs.updates[record.sobjectType]){
					Jobs.updates[record.sobjectType] = new BulkJob('update', record.sobjectType);
					CSV.updates[record.sobjectType] = record.fieldlist('update').join(','); //Header
				}
				CSV.updates[record.sobjectType] += '\n' + that.toCSV(record);
			}
			if(record.get('__locally_deleted__')){
				//Delete
				if(!Jobs.deletions[record.sobjectType]){
					Jobs.deletions[record.sobjectType] = new BulkJob('delete', record.sobjectType);
					CSV.deletions[record.sobjectType] = record.fieldlist('delete').join(','); //Header
				}
				CSV.deletions[record.sobjectType] += '\n' + that.toCSV(record);
			}
		});
	};

	this.distributeBatches = function(batchresultCB){
		for (var objectType in Jobs.inserts) {
		    Jobs.inserts[objectType].addBatch(CSV.inserts[objectType]);
		    Jobs.inserts[objectType].run(batchresultCB);
		}	

		for (var objectType in Jobs.updates) {
		    Jobs.updates[objectType].addBatch(CSV.updates[objectType]);
			Jobs.updates[objectType].run(batchresultCB);
		}

		for (var objectType in Jobs.deletions) {
		    Jobs.deletions[objectType].addBatch(CSV.deletions[objectType]);
			Jobs.deletions[objectType].run(batchresultCB);
		}
	};

	this.toCSV = function(record, operation){
		var fieldValues = [];
		record.fieldlist(operation).forEach(function(field){
			fieldValues.push(record.get(field));
		});
		return fieldValues.join(',');
	};
};