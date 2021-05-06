


//database connection and report created user's information.
var mysql = require('mysql');
var async = require('async');
require('datejs');
require('dotenv').config();
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var connection = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: 'moodle'
});

connection.connect(function(err){
  if (err) throw err;
});

var userReportsSchema = new Schema({

	reportName: {
		type: String
	},

	reportType: {
		type: String
	},

	dateCreated: {
		type: Date
	},

	dateModified: {
		type: Date
	},

	reportOwner: {
		type: String
	},

	ownerFirst: {
		type: String
	},

	owerLast: {
		type: String
	},

	reportLMS: {
		type: String,
		default: "Global"
	},

	reportData: {
		type: Array
	},

	reportSharingOptions: {
		type: String
	},

	reportUserLastModified: {
		type: String
	}
});

var UserReport = module.exports =  mongoose.model('UserReports', userReportsSchema);

module.exports.createReport = function(reportName, reportType, reportData, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, callback){
	var timestamp = new Date();

	report = new UserReport ({
		reportName: reportName,
		reportType: reportType,
		dateCreated: timestamp,
		dateModified: timestamp,
		reportOwner: reportOwner,
		ownerFirst: ownerFirst,
		ownerLast: ownerLast,
		reportLMS: reportLMS,
		reportSharingOptions: reportSharingOptions,
		reportUserLastModified: reportOwner,
		reportData: reportData
	});

	report.save(function(err, data){
		if (err) throw err;
		callback(null, data);
	});
};

module.exports.getCourseReportIds = function(reportName, reportOwner, callback){
	UserReport.find({reportName: reportName, reportOwner: reportOwner}, {reportData: 1}, function (err, ids){
		if (err) throw err;
		callback(null, ids[0]._doc.reportData);
	});
};

module.exports.getReport = function(reportId, callback){
	UserReport.findById(reportId, callback);
};

module.exports.listAvailableReports = function(userLMS, id, isAdmin, callback){
	if (isAdmin){
		UserReport.find({}, {reportId: 1, reportName: 1, reportType: 1, ownerFirst: 1, dateCreated: 1}, function(err, reports){
			if (err) throw err;
			callback(null, reports);
		});
	
	} else {
		UserReport.find(
		{$or: [
			{reportOwner: id}, 
			{reportSharingOptions: "Global"}, 
			{$and: [
				{reportSharingOptions: "lms"}, 
				{reportLMS: userLMS}
			]}
		]}, 
		{reportId: 1, reportName: 1, reportType: 1, ownerFirst: 1, dateCreated: 1},
		function (err, reports){
			if (err) throw err;
			callback(null, reports);
	});
	}
};

module.exports.deleteReport = function(reportId, callback){
	UserReport.remove({_id: reportId}, function(err, data){
		if (err) throw err;
		callback(null, data);
	});
};