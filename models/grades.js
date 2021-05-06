
// this for generating report where report type is not defined
var mysql = require('mysql');
var async = require('async');
require('datejs');
require('dotenv').config();
var util = require('util');
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

var prepostGradeResponseSchema = new Schema({

  courseId: {
    type: Number,
    default: 0
  },

  courseName: {
    type: String,
    default: "None"
  },

  lps: {
    type: String,
    default: "None"
  },

  reportingPeriodFrom: {
    type: Date,
    default: new Date()
  },

  reportingPeriodTo: {
    type: Date,
    default: new Date()
  },

  dateOfTraining: {
    type: Date,
    default: null
  },

  contactName: {
    type: String,
    default: "John Doe"
  },
  
  numTrainedCourse:{
    type: Number,
    default: 0
  },

  numCompletedPretest:{
    type: Number,
    default: 0
  },

  numPretestQue:{
    type: Number,
    default:0
  },

  PretestHighScore:{
    type: Number,
    default: 0
  },

  PretestLowScore:{
    type: Number,
    default:0
  },

  PretestAvgScore:{
    type: Number,
    default: 0
  },

  numCompletedPosttest:{
    type: Number,
    default: 0
  },

  numPosttestQue:{
    type: Number,
    default:0
  },

  PosttestHighScore:{
    type: Number,
    default: 0
  },

  PosttestLowScore:{
    type: Number,
    default:0
  },

  PosttestAvgScore:{
    type: Number,
    default: 0
  },
  numCompletedoldPretest:{
    type: Number,
    default: 0
  },

  numoldPretestQue:{
    type: Number,
    default:0
  },

  OldPretestHighScore:{
    type: Number,
    default: 0
  },

  OldPretestLowScore:{
    type: Number,
    default:0
  },

  OldPretestAvgScore:{
    type: Number,
    default: 0
  },

  numCompletedoldPosttest:{
    type: Number,
    default: 0
  },

  numoldPosttestQue:{
    type: Number,
    default:0
  },

  OldPosttestHighScore:{
    type: Number,
    default: 0
  },

  OldPosttestLowScore:{
    type: Number,
    default:0
  },

  OldPosttestAvgScore:{
    type: Number,
    default: 0
  },

  numCertification:{
    type: Number,
    default:0
  },
  
  Reason:{
    type: String,
    default: "None" 
  },

  courseDataCompleted: {
    type: Boolean,
    default: false
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
  }

});

var PrepostCourseGrades = module.exports =  mongoose.model('PrepostCourseGrades', prepostGradeResponseSchema);

//export function from reports.js
module.exports.createCourses = function(fromDate, toDate, reportName, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, callback){

var query = getQuery("grades");

  if (query) { 
    var results;
    queryDB(query, function(err, results){
      if (err) throw err;
    
      results = filterResults(fromDate, toDate, results);
      
      if (results) {
        var final = gradeAnalysis(results);
        var resultsQuery = getQuery("quizQue");

        queryDB(resultsQuery, function(err, results){
          if (err) throw err;

        var data= quizQuestionAnalysis(results, final);
          //console.log("courses", data);
          var timeStampNow = new Date();
          var i = 0;
          async.eachSeries(final, function(course, next) {
            course = new PrepostCourseGrades();
            parseCourseObject(course, data[i], fromDate, toDate, timeStampNow, function(err, results){
              course = results;
              //console.log(course);
              course.reportName = reportName;
              course.reportOwner = reportOwner;

            //new schema function end 
            //console.log("courses",course);
             course.save(function(err, results){

              i++;
              next();
              });
            });//save function
            //console.log(course);
          }, function(err) {
          if (err) throw err;
          results = "";
          
          callback(null, results);   
          });//async function

        });// Quiz deb function
       
      } else {
         err = new Error('Invalid Date Range');
          results = "There was an error, please try again";
          callback(err, results);
      }//if results
    });//DB function end
  } else{
    err = new Error('Invalid Date Range');
    results = "There was an error, please try again";
    callback(err, results);
  }//if query condition close

};//export function

//useful function***********************************
function getQuery(reportType, courseid){
 if (reportType == "grades") {
    return "select gg.userid AS 'userId', gi.courseid AS 'courseId',c.fullname AS 'courseName', gi.itemname AS 'itemName', ROUND (gg.finalgrade, 2) AS 'grade', DATE_FORMAT(FROM_UNIXTIME(gg.timemodified), '%Y-%m-%d') AS 'dateTime' from mdl_grade_grades as gg join mdl_grade_items as gi on gg.itemid = gi.id join mdl_course as c on gi.courseid = c.id join mdl_user as u on gg.userid = u.id WHERE (gi.itemname LIKE '%re%est%' OR gi.itemname LIKE'%ost%est%') and gg.finalgrade is not NULL ORDER BY courseId ASC, dateTime ASC, userId ASC";
  }else if (reportType == "enrolleeData") {
    return "SELECT e.courseid AS 'courseId', ue.userid as 'UserID', DATE_FORMAT(FROM_UNIXTIME(ue.timestart), '%Y-%m-%d') AS 'dateTime' FROM mdl_user_enrolments AS ue JOIN mdl_enrol AS e ON ue.enrolid = e.id JOIN mdl_course AS c ON e.courseid = c.id WHERE courseid = " + courseid + ";";
  } else if(reportType == "quizQue"){
    return "select q.course as courseID, qua.questionid as questionId, q.name as quizName from mdl_context as cx join mdl_question_usages as quu on cx.id = quu.contextid join mdl_question_attempts as qua on qua.questionusageid = quu.id join mdl_quiz_attempts as qa on qa.uniqueid = quu.id join mdl_quiz as q on q.id = qa.quiz ORDER BY courseId ASC";
  }
}

//Useful function ********************************
function queryDB(query, callback){
  var data;
  connection.query(query, function(err, results, feilds){
      if(err) throw err;
      callback(null, results);
  }); 
}

//Useful function ********************************
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


//Useful function**********************************************
function gradeAnalysis(data){
  // data is an arrary of objects each of which includes: userId, courseId, courseName, grade, and graded(as a date)
  var courseList = [];
  var courseids = [];
  //var undeterminedObjects = [];

  function AggregateCourseGrades(name, id) { // Set up object ACG = Aggregate Course Grades object
     this.name = name;
    this.id = id;
    this.preScoreids = [];
    this.oldpreScoreids = [];
    this.preScores = [];
    this.oldpreScores = [];
    this.preQue = [];
    this.oldpreQue = [];
    this.postScoreids = [];
    this.oldpostScoreids = [];
    this.postScores = [];
    this.oldpostScores = [];
    this.postQue = [];
    this.oldpostQue = [];
    this.preTestCount = 0;
    this.oldpreTestCount = 0;
    this.postTestCount = 0;
    this.oldpostTestCount = 0;
    this.preMax = 0;
    this.oldpreMax = 0;
    this.postMax = 0;
    this.oldpostMax = 0;
    this.preMin = 0;
    this.oldpreMin = 0;
    this.postMin = 0;
    this.oldpostMin = 0;
    this.preAverage = 0;
    this.oldpreAverage = 0;
    this.postAverage = 0;
    this.oldpostAverage = 0;
  };

  for (var i = 0; i < data.length; i++){ // Loop through each data object
    var curCourse = data[i]; 
    
    if (courseids.indexOf(curCourse.courseId) < 0) { // If the course id is not found in a list of known courses, create new ACG object      
      var course = new AggregateCourseGrades(curCourse.courseName, curCourse.courseId);
      courseids.push(course.id);
      courseList.push(course);
      course = regexAndScoreProcessing(course, curCourse);

    } else if ((course.id != curCourse.courseId) && (courseids.indexOf(curCourse.courseId) > 0)) { // If the aggregate course object already exists but isn't sequencial
      var id = course.id;
      var course = courseList.find( c => c.id === id);
      course = regexAndScoreProcessing(course, curCourse);

    } else if (course.id === curCourse.courseId) { // If already on the matching course object
      course = regexAndScoreProcessing(course, curCourse);
    }
  }

  //data = {courses: courseList, undetermined: undeterminedObjects}
  return courseList;
}


function quizQuestionAnalysis(results, data){
  var courseids=[];
  var courseList = data;

  for(var i=0; i < data.length; i++ ){
    courseids.push(data[i].id);
    } 

  for(var i = 0; i < results.length ; i++){
    
    var record = results[i];

    if(courseids.indexOf(record.courseID) >= 0){

        var id = record.courseID;
        course = courseList.find(c => c.id === id);

       if(regexMatch(record.quizName, '*re*est*')){
          
          if(regexMatch(record.quizName, '*ld*')){
              if(course.oldpreQue.indexOf(record.questionId) < 0)
              course.oldpreQue.push(record.questionId);
          } 
          else{
              if(course.preQue.indexOf(record.questionId) < 0)
              course.preQue.push(record.questionId);
          }
        
        }else if(regexMatch(record.quizName, '*ost*est*')){
           
          if(regexMatch(record.quizName, '*ld*')){
              if(course.oldpostQue.indexOf(record.questionId) < 0)
              course.oldpostQue.push(record.questionId);
            }else{
              if(course.postQue.indexOf(record.questionId) < 0)
                course.postQue.push(record.questionId);
            }

        }
      } //course ids index if end
   } // results for end
  
 return courseList;
} 

function parseCourseObject(course, curCourse, fromDate, toDate, timeStampNow, callback){
  
            course.courseId = curCourse.id;
            course.courseName = curCourse.name;
            course.reportingPeriodFrom = fromDate;
            course.reportingPeriodTo = toDate;
            course.numCompletedPretest = curCourse.preTestCount;
            course.numPretestQue = curCourse.preQue.length;
            course.PretestHighScore = curCourse.preMax;
            course.PretestLowScore = curCourse.preMin;
            course.PretestAvgScore = curCourse.preAverage;
            course.numCompletedPosttest = curCourse.postTestCount;
            course.numPosttestQue = curCourse.postQue.length;
            course.PosttestHighScore = curCourse.postMax;
            course.PosttestLowScore = curCourse.postMin;
            course.PosttestAvgScore = curCourse.postAverage; 
            //old quizzes
            course.numCompletedoldPretest =curCourse.oldpreTestCount;
            course.numoldPretestQue = curCourse.oldpreQue.length;
            course.OldPretestHighScore = curCourse.oldpreMax;
            course.OldPretestLowScore = curCourse.oldpreMin;
            course.OldPretestAvgScore = curCourse.oldpreAverage;
            course.numCompletedoldPosttest = curCourse.oldpostTestCount;
            course.numoldPosttestQue = curCourse.oldpostQue.length;
            course.OldPosttestHighScore = curCourse.oldpostMax;
            course.OldPosttestLowScore =  curCourse.oldpostMin;
            course.OldPosttestAvgScore = curCourse.oldpostAverage;
            course.timeStamp = timeStampNow;

   var query = getQuery("enrolleeData", course.courseId);

  if (query)

   {
    var studentsList = [];
    queryDB(query, function(err, results){
      if (err) throw err;
      course.numTrainedCourse = 0;
      for (var m = 0; m < results.length; m++){ 

        if( (studentsList.indexOf(results[m].UserID) < 0) && (results[m].UserID != 0) ){

            var enrollDate = new Date(results[m].dateTime); // for some reason this date is in seconds and not milliseconds, thanks moodle
            if (enrollDate >= new Date(fromDate) && enrollDate <= new Date(toDate)){
               studentsList.push(results[m].UserID);
            }
        }
      }
       course.numTrainedCourse = studentsList.length;
       //console.log(studentsList.length);
       //console.log(course);
       callback(null, course);
    });

  } else {
    course.numTrainedCourse = 0;
    callback(null, course);
  }
}

function regexAndScoreProcessing(course, curCourse){
  
  if (regexMatch(curCourse.itemName, '*re*est*')){ //Should really have better naming conventions for pre and post tests
    if(regexMatch(curCourse.itemName, '*ld*')){
      //console.log("old pre test:", curCourse.itemName);
      course.oldpreScores.push(curCourse.grade);
      course.oldpreScoreids.push(curCourse.userId);
      course.oldpreTestCount = course.oldpreScores.length;
      course.oldpreMax = Math.max(...course.oldpreScores);
      course.oldpreMin = Math.min(...course.oldpreScores);
      course.oldpreAverage = getAvg(course.oldpreScores).toFixed(2);
    }else{
      //console.log("pre test:", curCourse.itemName);
      course.preScores.push(curCourse.grade);
      course.preScoreids.push(curCourse.userId);
      course.preTestCount = course.preScores.length;
      course.preMax = Math.max(...course.preScores);
      course.preMin = Math.min(...course.preScores);
      course.preAverage = getAvg(course.preScores).toFixed(2);
    }
    
  
  } else if (regexMatch(curCourse.itemName, '*ost*est*')){
    
    if(regexMatch(curCourse.itemName, '*ld*')){
      //console.log("old post test:", curCourse.itemName);
      course.oldpostScores.push(curCourse.grade);
      course.oldpostScoreids.push(curCourse.userId);
      course.oldpostTestCount = course.oldpostScores.length;
      course.oldpostMax = Math.max(...course.oldpostScores);
      course.oldpostMin = Math.min(...course.oldpostScores);
      course.oldpostAverage = getAvg(course.oldpostScores).toFixed(2);
    }else{
      //console.log("post test:", curCourse.itemName);
      course.postScores.push(curCourse.grade);
      course.postScoreids.push(curCourse.userId);
      course.postTestCount = course.postScores.length;
      course.postMax = Math.max(...course.postScores);
      course.postMin = Math.min(...course.postScores);
      course.postAverage = getAvg(course.postScores).toFixed(2);

    }
    
  }

  return course;
}
Array.prototype.sum = function(){
  return this.reduce(function(a,b){
    return a+b;
  });
};

Array.prototype.min = function(){
  return this.reduce(function(a,b){
    return Math.min(a, b);
  });
};

Array.prototype.max = function(){
  return this.reduce(function(a,b){
    return Math.max(a, b);
  });
};

//Useful functions ***************
function getAvg(arr){ return (arr.sum()/arr.length);
}

//Useful functions ***************
function regexMatch(str, rule){ return new RegExp("^" + rule.split("*").join(".*") + "$").test(str);
}

///Useful function ********************

//export function from report.js for saving report
//this function generates all the data about the report info and the user data
//
module.exports.saveCoursesToUserReport = function(reportName, reportType, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, callback){
  PrepostCourseGrades.find({reportName: reportName, reportOwner: reportOwner}, {_id: 1}, function(err, reportData){
    if (err) throw err;
   
    UserReport.createReport(reportName, reportType, reportData, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, function(err, data){
      if (err) throw err;
      
      callback(null, data);
    });
  });
};

//export function from report.js fro generating excel doc
module.exports.listCourses = function(ids, callback){
  PrepostCourseGrades.find({
    '_id': { $in: ids}}, {courseName: 1, courseId: 1, courseDataCompleted: 1, reportingPeriodFrom: 1, reportingPeriodTo: 1,  _id: 1}, function(err, courses){
    if (err) throw err;
        callback(null, courses);
  });
};

module.exports.generateExcelFile = function(ids, callback){

  PrepostCourseGrades.find({
    
    '_id': { $in: ids}}, function(err, courses){

    var wb = new xl.Workbook();
    var ws = wb.addWorksheet('Pre and Post Test Report');

    var styleBlue = {
          alignment: {wrapText: true}, 
          fill: {type: 'pattern', patternType: 'solid', fgColor: 'A5C3F2'},
          border: {left: {style: 'thin', color: '000000'}, right: {style: 'thin', color: '000000'}, top: {style: 'thin', color: '000000'}, bottom: {style: 'thin', color: '000000'}}
        };

    var styleRed = {
          alignment: {wrapText: true}, 
          fill: {type: 'pattern', patternType: 'solid', fgColor: 'E8999A'},
          border: {left: {style: 'thin', color: '000000'}, right: {style: 'thin', color: '000000'}, top: {style: 'thin', color: '000000'}, bottom: {style: 'thin', color: '000000'}}
        };

    var styleYellow = {
          alignment: {wrapText: true}, 
          fill: {type: 'pattern', patternType: 'solid', fgColor: 'FEE49D'},
          border: {left: {style: 'thin', color: '000000'}, right: {style: 'thin', color: '000000'}, top: {style: 'thin', color: '000000'}, bottom: {style: 'thin', color: '000000'}}
        }; 

    var styleGrey = {
          alignment: {wrapText: true}, 
          fill: {type: 'pattern', patternType: 'solid', fgColor: 'DCDCDC'},
          border: {left: {style: 'thin', color: '000000'}, right: {style: 'thin', color: '000000'}, top: {style: 'thin', color: '000000'}, bottom: {style: 'thin', color: '000000'}}
        };     
      //First row color coding
    ws.cell(1, 1, 1, 5, true).string('Reporting Information').style(styleBlue);
    // ...
      ws.cell(1, 6, 1, 7, true).string('Course Information').style(styleRed);
      ws.cell(1, 8, 1, 17, true).string('Current Pre/Post Test').style(styleYellow);
      ws.cell(1, 18, 1, 29, true).string('Old Pre/Post Test').style(styleGrey);  
      //second row color coding 
      //---Reporting info        
      ws.cell(2, 1).string('LPS/Partner').style(styleBlue);
      ws.cell(2, 2).string('Reporting Period From:').style(styleBlue);
      ws.cell(2, 3).string('Reporting Period To:').style(styleBlue);
      ws.cell(2, 4).string('Date of Training (if live training session)').style(styleBlue);
      ws.cell(2, 5).string('Contact Title').style(styleBlue);

      // ---course info
      ws.cell(2, 6).string('Course Name').style(styleRed);
      ws.cell(2, 7).string('# of Trainees Attempting Course').style(styleRed);
    
      //--cureent pre/post 
      ws.cell(2, 8).string('# of Trainees Completing Pre-Test').style(styleYellow);
      ws.cell(2, 9).string('# of Pre-Test Questions').style(styleYellow);
      ws.cell(2, 10).string('Pre-Test Highest Score').style(styleYellow);
      ws.cell(2, 11).string('Pre-Test Lowest Score').style(styleYellow);
      ws.cell(2, 12).string('Pre-Test Avg Score').style(styleYellow);
      ws.cell(2, 13).string('# of Trainees Completing Post-Test').style(styleYellow);
      ws.cell(2, 14).string('# of Post-Test Questions').style(styleYellow);
      ws.cell(2, 15).string('Post-Test Highest Score').style(styleYellow);
      ws.cell(2, 16).string('Post-Test Lowest Score').style(styleYellow);
      ws.cell(2, 17).string('Post-Test Avg Score').style(styleYellow);

      //--Old pre-post info  
      ws.cell(2, 18).string('# of Trainees Completing Old Pre-Test').style(styleGrey);
      ws.cell(2, 19).string('# of Old Pre-Test Questions').style(styleGrey);
      ws.cell(2, 20).string('Old Pre-Test Highest Score').style(styleGrey);
      ws.cell(2, 21).string('Old Pre-Test Lowest Score').style(styleGrey);
      ws.cell(2, 22).string('Old Pre-Test Avg Score').style(styleGrey);
      ws.cell(2, 23).string('# of Trainees Completing Old Post-Test').style(styleGrey);
      ws.cell(2, 24).string('# of Old Post-Test Questions').style(styleGrey);
      ws.cell(2, 25).string('Old Post-Test Highest Score').style(styleGrey);
      ws.cell(2, 26).string('Old Post-Test Lowest Score').style(styleGrey);
      ws.cell(2, 27).string('Old Post-Test Avg Score').style(styleGrey);
      ws.cell(2, 28).string('Number Using for Certification').style(styleGrey);
      ws.cell(2, 29).string('Reason Pre/Post Not Collected').style(styleGrey);
      
    
    var row = 3;
    
    for (var i = 0; i < courses.length; i++){
      var c = courses[i];
      ws.cell(row, 1).string(c.lps).style({ alignment: {wrapText: true} });
      ws.cell(row, 2).date(new Date(c.reportingPeriodFrom));
      ws.cell(row, 3).date(new Date(c.reportingPeriodTo));
      
      if (c.dateOfTraining) {
        ws.cell(row, 4).date(new Date(c.dateOfTraining));
      } else {
        ws.cell(row, 4).string("NONE");
      }
      
      ws.cell(row, 5).string(c.contactName).style({ alignment: {wrapText: true} });
      ws.cell(row, 6).string(c.courseName).style({ alignment: {wrapText: true} });
      ws.cell(row, 7).number(c.numTrainedCourse);
      ws.cell(row, 8).number(c.numCompletedPretest);
      ws.cell(row, 9).number(c.numPretestQue);
      ws.cell(row, 10).number(c.PretestHighScore);
      ws.cell(row, 11).number(c.PretestLowScore);
      ws.cell(row, 12).number(c.PretestAvgScore);
      ws.cell(row, 13).number(c.numCompletedPosttest);
      ws.cell(row, 14).number(c.numPosttestQue);
      ws.cell(row, 15).number(c.PosttestHighScore);
      ws.cell(row, 16).number(c.PosttestLowScore);
      ws.cell(row, 17).number(c.PosttestAvgScore);
      
      if((c.numoldPretestQue == 0) && (c.numoldPosttestQue == 0) ){

      ws.cell(row, 18).number(c.numCompletedoldPretest).style(styleRed);
      ws.cell(row, 19).number(c.numoldPretestQue).style(styleRed);
      ws.cell(row, 20).number(c.OldPretestHighScore).style(styleRed);
      ws.cell(row, 21).number(c.OldPretestLowScore).style(styleRed);
      ws.cell(row, 22).number(c.OldPretestAvgScore).style(styleRed);
      ws.cell(row, 23).number(c.numCompletedoldPosttest).style(styleRed);
      ws.cell(row, 24).number(c.numoldPosttestQue).style(styleRed);
      ws.cell(row, 25).number(c.OldPosttestHighScore).style(styleRed);
      ws.cell(row, 26).number(c.OldPosttestLowScore).style(styleRed);
      ws.cell(row, 27).number(c.OldPosttestAvgScore).style(styleRed);
      ws.cell(row, 28).number(c.numCertification).style(styleRed);
      ws.cell(row, 29).string('No old Pre/Post tests for this course').style({ alignment: {wrapText: true} });

     } else {
      ws.cell(row, 18).number(c.numCompletedoldPretest);
      ws.cell(row, 19).number(c.numoldPretestQue);
      ws.cell(row, 20).number(c.OldPretestHighScore);
      ws.cell(row, 21).number(c.OldPretestLowScore);
      ws.cell(row, 22).number(c.OldPretestAvgScore);
      ws.cell(row, 23).number(c.numCompletedoldPosttest);
      ws.cell(row, 24).number(c.numoldPosttestQue);
      ws.cell(row, 25).number(c.OldPosttestHighScore);
      ws.cell(row, 26).number(c.OldPosttestLowScore);
      ws.cell(row, 27).number(c.OldPosttestAvgScore);
      ws.cell(row, 28).number(c.numCertification);
      ws.cell(row, 29).string(c.Reason).style({ alignment: {wrapText: true} });
     }

      row += 1;
    }
    var fileName = "PrePostReport.xlsx";
    wb.write(fileName);
    callback(null, fileName);
  });
};

//export from report.js for deleting report
module.exports.deleteCourses = function(ids, callback){
 PrepostCourseGrades.remove({'_id': {$in: ids}}, function(err, data){
    if (err) throw err;
    callback(null, data);
  });
};

//export from report.js for undefined columns update through form 
module.exports.updateCourse = function(course, formData, callback){

  var courseInfo = {
    lps: formData.pplps,
    dateOfTraining: formData.ppdateoftraining,
    contactName: formData.ppcontactname,
    numCertification: formData.ppnumcertification,
    Reason:formData.ppreasonnotcollected,
    courseDataCompleted: true

  };

   PrepostCourseGrades.update({_id: course.id}, courseInfo, function(err, data){
    if (err) throw err;
    callback(null, data);
  });
};

//export from report.js for table generation
module.exports.getCourses = function(ids, callback){
  PrepostCourseGrades.find({'_id': {$in: ids}}, function(err, courses){
    if (err) throw err;
    callback(null, courses);
  });
};

module.exports.getOneCourse = function(courseName, courseId, callback){
  PrepostCourseGrades.find({courseName: courseName, courseId: courseId}, function(err, course){
    if (err) throw err;
    callback(null, course);
  });
};