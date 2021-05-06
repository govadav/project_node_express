
var mysql = require('mysql');
var async = require('async');
require('datejs');
require('dotenv').config();
var xl = require('excel4node');
var mongoose = require('mongoose');
var UserReport = require('../models/userReports');
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

var courseDataSchema = new Schema({
	courseId: {
	  type: Number
	},

	courseName: {
	  type: String
	},

	numberOfStudents: {
	  type: Number
	}
});

var courseData = mongoose.model('courseData', courseDataSchema);

var auditCourseSchema = new Schema({

  coursesAndStudents: {
  	type: Array
  },
  	
  timeStamp: {
    type: Date
  },

  reportOwner: {
    type: String,
    default: ""
  },

  reportName: {
    type: String,
    default: ""
  },
});

var auditCourse = module.exports = mongoose.model('auditCourse', auditCourseSchema);

function getQuery(){
    return "SELECT c.fullname AS 'courseName', c.id AS 'courseId', g.name AS 'groupName', gm.userid AS 'userID', FROM_UNIXTIME(gm.timeadded, '%Y-%m-%d') AS 'dateTime' FROM mdl_groups g  JOIN mdl_groups_members AS gm ON g.id = gm.groupid JOIN mdl_course AS c ON g.courseid = c.id WHERE (g.name LIKE '%udit%')";
}

function queryDB(query, callback){
  var data;
  connection.query(query, function(err, results, feilds){
      if(err) throw err;
      callback(null, results);
  }); 
}

function filterResults(fromDate, toDate, results){
  var begDate = new Date(fromDate);
  var endDate = new Date(toDate);
  for (var i = 0; i < results.length; i++){
    var curDate = new Date(results[i].dateTime);
    if (begDate > curDate || curDate > endDate) {
      results.splice(i, 1);
      i = i - 1;
    }
  }
  return results;
}

function parseCourseData(enrollees){
	var courseIds = [];
	var courses = [];
	var course;
	for (var i = 0; i < enrollees.length; i++){
		if (courseIds.indexOf(enrollees[i].courseId) < 0){
			course = new courseData();
			course.courseId = enrollees[i].courseId;
			course.courseName = enrollees[i].courseName;
			course.numberOfStudents = 1;
			courses.push(course);
			courseIds.push(course.courseId);
		} else if (courseIds.indexOf(enrollees[i].courseId) >= 0 && course.courseId != enrollees[i].courseId) {
			course = courses.find(c => c.courseId === enrollees[i].courseId);
			course.numberOfStudents += 1;
		} else {
			course.numberOfStudents += 1;
		}
	}
	
	return courses;
}

module.exports.createCourses = function(fromDate, toDate, reportName, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, callback){
    var query = getQuery();
    var results;
    
    if (query) { 
      queryDB(query, function(err, results){
        if (err) throw err;
        results = filterResults(fromDate, toDate, results);
    
        if (results) {
                    
    	var courses = parseCourseData(results);
    	var auditData = new auditCourse();

    	auditData.coursesAndStudents = courses;
    	auditData.timeStamp = new Date();
    	auditData.reportOwner = reportOwner;
    	auditData.reportName = reportName;

    	auditData.save(function(err, results){
    		if (err) throw err;
    		callback(null, results);
    	});
        } else {
          err = new Error('Invalid Date Range');
          results = "There was an error, please try again";
          callback(err, results);
        }
      });
    } else {
      var err = new Error('Invalid Report Type');
      results = "There was an error, plase try again";
      callback(err, results);
    }
};

module.exports.saveCoursesToUserReport = function(reportName, reportType, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, callback){
  auditCourse.find({reportName: reportName, reportOwner: reportOwner}, {_id: 1}, function(err, reportData){
    if (err) throw err;
   
    UserReport.createReport(reportName, reportType, reportData, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, function(err, data){
      if (err) throw err;
      callback(null, data);
    });
  });
};

module.exports.listCourses = function(ids, callback){
  auditCourse.find({
    '_id': { $in: ids}}, function(err, courses){
    if (err) throw err;
    callback(null, courses);
  });
};

module.exports.deleteCourses = function(ids, callback){
  auditCourse.remove({'_id': {$in: ids}}, function(err, data){
    if (err) throw err;
    callback(null, data);
  });
};

module.exports.generateExcelFile = function(ids, callback){
  auditCourse.find({
    '_id': { $in: ids}}, function(err, courses){
    if (err) throw err;
    var wb = new xl.Workbook();
    var ws = wb.addWorksheet('Audit Enrollment');

    var styleYellow = {
      font: {bold: true},
      alignment: {wrapText: true, horizontal: 'center'},
      fill: {type: 'pattern', patternType: 'solid', fgColor: 'FCE5CD'},
      border: {left: {style: 'thin', color: '000000'}, right: {style: 'thin', color: '000000'}, top: {style: 'thin', color: '000000'}, bottom: {style: 'thin', color: '000000'}}
    };

    var styleNoColorData = {
      alignment: {wrapText: true, horizontal: 'center'}
    };

    // SECTION TITLES
     ws.cell(1, 1).string('Course Name').style(styleYellow);
     ws.cell(1, 2).string('Number of Enrollees').style(styleYellow);
     
     var row = 2;

     for (var i = 0; i < courses[0]._doc.coursesAndStudents.length; i++ ){
     	var course = courses[0]._doc.coursesAndStudents[i];
     	ws.cell(row, 1).string(course.courseName);
     	ws.cell(row, 2).number(course.numberOfStudents);
     	row += 1;
     };

    var fileName = "auditEnrollment.xlsx";
    wb.write(fileName);
    callback(null, fileName);
  });
};