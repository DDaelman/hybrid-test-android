/*
* THIS EXTENSION TO SMARTSYNC USES THE SALESFORCE BULK API TO STORE MANY RECORDS AT ONCE ON THE SERVER
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
		saveAllAndSync: function(records, completeCB){
			LOG('SMARTSYNC-BULK -- SAVE AND SYNC ALL START', records);
			//CHECK FOR CONFLICTS?
			var loader = new BulkDataLoader();
			loader.saveAll(records, completeCB); //Saving to SF
			var jsonRecords = [];
			records.forEach(function(rec){
				jsonRecords.push(rec.toJSON());
			});
			this.saveAll(jsonRecords, false);
			LOG('SMARTSYNC-BULK -- SAVE AND SYNC ALL COMPLETE', records);
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

	this.create = function(onJobReady){
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
			LOG('SMARTSYNC-BULK -- CREATE JOB REPONSE', that.jobId);
			onJobReady();
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
			LOG('SMARTSYNC-BULK -- CREATE BATCH REPONSE', batchId);
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

	this.run = function(completeCB){		
		var that = this;		
		this.create(function(){							//Create Job on SF
			that.batches.forEach(function(CSVBatch){	
				that.runBatch(CSVBatch);				//Start adding batches when Job created
			});						
			that.checkBatchStatus(completeCB);					//Monitor status and close when batches processed
		});
	};

	this.checkBatchStatus = function(completeCB){
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
					that.checkBatchRecords(id, completeCB);
					processedCount++;
				}
			}
			//Probably not the most efficient use of API call limits, though batch counts should never be high anyway
			if(processedCount != that.batches.length){
				that.checkBatchStatus(completeCB);
			}else{
				that.close();				
			}
		};
		xhr.send();
	};

	this.checkBatchRecords = function(id, completeCB){
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
					that.failedRecords.push(row[0]);
					LOG('SMARTSYNC-BULK -- RECORD ERROR', row[0]);
				}else{
					if(row[0] !== 'Id' && row[0] !== ''){
						that.processedRecords.push(row[0]);
						LOG('SMARTSYNC-BULK -- RECORD SUCCESS', row[0]);
					}
				}
			});
			completeCB({
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

	this.saveAll = function(records, completeCB){
		//Records can contain data for multiple object types
		completeCB({
			status: 'init',
			failed: [],
			succeeded: []
		});
		this.separateJobs(records);
		
		completeCB({
			status: 'processing',
			failed: [],
			succeeded: []
		});
		this.distributeBatches(completeCB);		
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

	this.distributeBatches = function(completeCB){
		for (var objectType in Jobs.inserts) {
		    Jobs.inserts[objectType].addBatch(CSV.inserts[objectType]);
		    Jobs.inserts[objectType].run(completeCB);
		}	

		for (var objectType in Jobs.updates) {
		    Jobs.updates[objectType].addBatch(CSV.updates[objectType]);
			Jobs.updates[objectType].run(completeCB);
		}

		for (var objectType in Jobs.deletions) {
		    Jobs.deletions[objectType].addBatch(CSV.deletions[objectType]);
			Jobs.deletions[objectType].run(completeCB);
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