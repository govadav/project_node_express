var mysql = require('mysql');
var async = require('async');
require('datejs');
require('dotenv').config();
var xl = require('excel4node');
var mongoose = require('mongoose');
//who is generating the report will be recorded so we need this file 
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

var questionResponseSchema = new Schema({
  question: {
    type: String,
  },

  numStrongDis: {
    type: Number,
    default: 0
  },

  percentStrongDis: {
    type: Number,
    default: 0
  },

  numDis: {
    type: Number,
    default: 0
  },

  percentDis: {
    type: Number,
    default: 0
  },

  numNeutral: {
    type: Number,
    default: 0
  },

  percentNeutral: {
    type: Number,
    default: 0
  },

  numAgree: {
    type: Number,
    default: 0
  },

  percentAgree: {
    type: Number,
    default: 0
  },

  numStrongAgree: {
    type: Number,
    default: 0
  },

  percentStrongAgree: {
    type: Number,
    default: 0
  },

  numTotal: {
    type: Number,
    default: 0
  },

  itemPresent: {
    type: Boolean,
    default: false
  }
});

var questionResponse = mongoose.model('questionResponse', questionResponseSchema);

var cmCourseSchema = new Schema({
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

  durationHours: {
    type: Number,
    default: 0
  },

  numTimesOffered: {
    type: Number,
    default: 0
  },

  deliveryMode: {
    type: String,
    default: "None"
  },

  primaryCompetency: {
    type: String,
    default: "None"
  },

  numTrained: {
    type: Number,
    default: 0
  },

  numResponses: {
    type: Number,
    default: 0
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
  },

  visible: {
    type: Boolean
  },

  courseStartDate: {
    type: String
  },

  subjectMatter: questionResponseSchema,

  actionsToApply: questionResponseSchema,

  clearlyPresented: questionResponseSchema,

  overallSatisfaction: questionResponseSchema,

  learningObejectivesMet: questionResponseSchema
});

var CmCourse = module.exports =  mongoose.model('CmCourse', cmCourseSchema);


module.exports.createCourses = function(fromDate, toDate, reportName, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, callback){
  //console.log(fromDate);
   // console.log(toDate);
  var query = getQuery("getAllCourses");

  queryDB(query, function(err, results) { // Query all courses
    var allCourses = parseCourseToACF(results);

    debugger;


    query = getQuery("feedbackData");
  
    if (query) { 
      queryDB(query, function(err, results){ // Query feedback items
        if (err) throw err;
        
        var results = filterResults(fromDate, toDate, results);
        //console.log(results);
        if (results) {

          results = feedbackAnalysis(results, allCourses);
           // console.log(results.fbQs);
          var timeStampNow = new Date();
          var i = 0;
          async.eachSeries(results, function(course, next) {
            course = new CmCourse();
            parseCourseObject(course, results[i], fromDate, toDate, timeStampNow, function(err, data){
              course = data;
                  //console.log("after", course.numTrained);
                  //console.log(course.subjectMatter);
              course.reportName = reportName;
              course.reportOwner = reportOwner;
              course.position = i;
              course.save(function(err, results){
                i++;
                next();
              });
            });
          }, function(err) {
            if (err) throw err;
              results = "";
              callback(null, results);
            });
      
        } else {
          err = new Error('Invalid Date Range');
          results = "There was an error, please try again";
          callback(err, results);
        }
      }); // End query feedback items
    
    } else {
      var err = new Error('Invalid Report Type');
      results = "There was an error, plase try again";
      callback(err, results);
    }
  });
};



function getQuery(queryType, courseid){
  if (queryType == "feedbackData"){
    return "SELECT c.fullname AS 'courseName', fb.course AS 'courseId', fb.id AS 'courseFbSetId', fbc.id AS 'submissionId', FROM_UNIXTIME(fbc.timemodified, '%Y-%m-%d') AS 'dateTime', fbc.userid AS 'userId', fbi.id AS 'questionId', fbi.name AS 'question', fbi.presentation AS 'label', fbv.value AS 'response' FROM mdl_feedback as fb JOIN mdl_feedback_item AS fbi ON fb.id = fbi.feedback JOIN mdl_feedback_value AS fbv ON fbi.id = fbv.item JOIN mdl_feedback_completed AS fbc ON fbv.completed = fbc.id JOIN mdl_course AS c ON fb.course = c.id ORDER BY fb.id, CourseId;";
  } else if (queryType == "enrolleeData") {
    return "SELECT e.courseid AS 'courseId', ue.userid as 'UserID', DATE_FORMAT(FROM_UNIXTIME(ue.timestart), '%Y-%m-%d') AS 'dateTime' FROM mdl_user_enrolments AS ue JOIN mdl_enrol AS e ON ue.enrolid = e.id JOIN mdl_course AS c ON e.courseid = c.id WHERE courseid = " + courseid + ";";
  } else if (queryType == "courseDuration") {
    return "SELECT printhours FROM mdl_certificate WHERE course = " + courseid + ";";
  } else if (queryType == "getAllCourses") {
    return "SELECT id, fullname, CASE WHEN visible = 0 THEN 'false' ELSE 'true' END AS 'visible', FROM_UNIXTIME(startdate, '%m-%d-%Y') as 'startdate' FROM mdl_course;";
  }
}

function queryDB(query, callback){
  var data;
  connection.query(query, function(err, results, feilds){
      if(err) throw err;
      callback(null, results);
  }); 
}

function parseCourseToACF(courses){
  var allCourses = [];
  var course;

  function ACF(name, id, visible, startdate) { //ACF = Aggregate Course Feedback; For each course compile all question objects
    this.name = name;
    this.id = id;
    this.visible = visible;
    this.startdate = startdate;
    this.fbQs =[];
    this.fbQIds = [];
  }

  for (var i = 0; i < courses.length; i++){

    course = new ACF(courses[i].fullname, courses[i].id, JSON.parse(courses[i].visible), courses[i].startdate);
    allCourses.push(course);
  }
  return allCourses;
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

function feedbackAnalysis(data, allCourses){
  
  var coursesList = allCourses;
  var courseids = [];
  var course  = {id: 0}; // Instantiate the course object with id 0 so the logic below works

  for (var i = 0; i < allCourses.length; i++){
    courseids.push(allCourses[i].id);
  }
   
  var questionids = [];

  function ACF(name, id) { //ACF = Aggregate Course Feedback; For each course compile all question objects
    this.name = name;
    this.id = id;
    this.visible;
    this.startdate;
    this.fbQs =[];
    this.fbQIds = [];
  }

  function AQR(fbSetId, questionId, question){ // AQR = Aggregate Question Responses; For each question, record all responses
    this.setId = fbSetId;
    this.id = questionId;
    this.question = question;
    this.qType = '';
    this.responses = '';
    this.numResponses = 0;
    this.avgResponse = 0;
  }

  for (var i = 0; i < data.length; i++){

    var curQuestion = data[i];

    if (relevantQuestion(curQuestion.question)){

      if (courseids.indexOf(curQuestion.courseId) < 0) { // If the course does not yet exist, create a new course
        course = new ACF(curQuestion.courseName, curQuestion.courseId); // Make course and question objects
        var question = new AQR(curQuestion.courseFbSetId, curQuestion.questionId, curQuestion.question);
        
        courseids.push(course.id); // Add course and question ids to global list of known ids
        questionids.push(question.id);
        course.fbQIds.push(question.id); // Add question ids to list of known ids related to the course
        question = getFbQType(question, curQuestion.label); // Create the proper response collection points
        question = feedbackProcessing(question, curQuestion); // Process the question data
        course.fbQs.push(question);
        coursesList.push(course); // Push the course object to list of courses

      } else if ((course.id != curQuestion.courseId) && (courseids.indexOf(curQuestion.courseId) > 0)) { // If the course does exist, but isn't sequencial
        var id = curQuestion.courseId;
        course = coursesList.find(c => c.id === id); // Set course object to the current question's course

        if (course.fbQIds.indexOf(curQuestion.questionId) < 0){ // if the question is new to the course
          var question = new AQR(curQuestion.courseFbSetId, curQuestion.questionId, curQuestion.question);
          questionids.push(question.id);
          course.fbQIds.push(question.id);
          question = getFbQType(question, curQuestion.label); // create the proper response collection points
          question = feedbackProcessing(question, curQuestion); // Process the question data
          course.fbQs.push(question);
        
        } else if ((question.id != curQuestion.questionId) && (course.fbQIds.indexOf(curQuestion.questionId) > 0)) { // If the question exists to the course but isn't sequencial
          var qid = curQuestion.questionId;
          var question = course.fbQs.find(q => q.id === qid); // Set question object to the current found question in the course
          question = feedbackProcessing(question, curQuestion); // Proecess the question data
          
        } else { // Question is known and sequencial
          question = feedbackProcessing(question, curQuestion); // Proecess the question data
        }

      } else if (course.id === curQuestion.courseId) { // Course is known and sequencial

        if (course.fbQIds.indexOf(curQuestion.questionId) < 0){ // if the question is new to the course
          var question = new AQR(curQuestion.courseFbSetId, curQuestion.questionId, curQuestion.question);
          questionids.push(question.id);
          course.fbQIds.push(question.id);
          question = getFbQType(question, curQuestion.label); // create the proper response collection points
          question = feedbackProcessing(question, curQuestion); // Process the question data
          course.fbQs.push(question);
        
        } else if ((question.id != curQuestion.questionId) && (course.fbQIds.indexOf(curQuestion.questionId) > 0)) { // If the question exists to the course but isn't sequencial
          var qid = curQuestion.questionId;
          var question = course.fbQs.find(q => q.id === qid); // Set question object to the current found question in the course
          question = feedbackProcessing(question, curQuestion); // Proecess the question data
          
        } else { // Question is known and sequencial
          question = feedbackProcessing(question, curQuestion); // Proecess the question data
        }

      }

    }
  }

  return coursesList;
}

function relevantQuestion(question){

  var comMetQs = {
    q1: "*ubject*atter*",
    q2: "*dentified*ctions*",
    q3: "*nformation*resented*learly*",
    q4: "*atisfied*verall*", 
    q5: "*earning*bjectives*",
  };


  if (regexMatch(question, comMetQs.q1) || regexMatch(question, comMetQs.q2) || regexMatch(question, comMetQs.q3) || regexMatch(question, comMetQs.q4) || regexMatch(question, comMetQs.q5)){
    return true;
  } else {
    return false;
  }
}

function getFbQType(question, label){
  if (regexMatch(label, '*agree*')){
    question.qType = "Rank";
    question.responses = {stronglyDisagree: 0, disagree: 0, neutral: 0, agree: 0, stronglyAgree: 0};
  
  } else if (label.includes('true') || label.includes('false') || label.includes('True') || label.includes('False')){ // for some reason the regex wasn't picking up on this
    question.qType = "TrueFalse";
    question.responses = {positive: 0, negative: 0};
  
  } else {
    question.qType = "FreeResponse";
    question.responses = [];
  }

  return question;
}


function feedbackProcessing(question, curQuestion){
  question = answerProcessing(question, curQuestion);
  question.numResponses += 1;
  return question;
}

function answerProcessing(question, curQuestion){
  
  if (question.qType == "Rank"){
    if (curQuestion.response == '1'){
      question.responses.stronglyDisagree += 1;
    } else if (curQuestion.response == '2') {
      question.responses.disagree += 1;
    } else if (curQuestion.response == '3') {
      question.responses.neutral += 1;
    } else if (curQuestion.response == '4') {
      question.responses.agree+= 1;
    } else if (curQuestion.response == '5') {
      question.responses.stronglyAgree += 1;
    } 

    question.avgResponse = getAverageFbRanked(question); 

  } else if (question.qType == "TrueFalse"){ // Changed to positive and negative because of the weak handlebars engine
    if (curQuestion.response == '1') {
      question.responses.positive += 1;
    } else if (curQuestion.response == '2'){
      question.responses.negative += 1;
    }

    question.avgResponse = getAverageFbTF(question);

  } else {
    question.responses.push(curQuestion.response);
  }

  return question;
}

function getAverageFbRanked(question){
  // Takes weighted average of each category
  var cat = question.responses;
  var ttlResponses = question.numResponses;
  
  var strongDisMult = 1;
  var disMult = 2;
  var neuMult = 3;
  var agrMult = 4;
  var strongAgrMult = 5;
  
  var strongDis = cat.stronglyDisagree;
  var dis = cat.disagree;
  var neu = cat.neutral;
  var agr = cat.agree;
  var strongAgr = cat.stronglyAgree;

  var average = (
           ((strongDisMult) * (strongDis/ttlResponses)) +
           ((disMult) * (dis/ttlResponses)) +
           ((neuMult) * (neu/ttlResponses)) +
           ((agrMult) * (agr/ttlResponses)) +
           ((strongAgrMult) * (strongAgr/ttlResponses))
      ).toFixed(2);
  
  if (average == NaN || average == null) {
    return 0;
  } else {
    return average;
  }
}

function getAverageFbTF(question){
  var ttlResponses = question.numResponses;
  var numTrue = question.responses.positive;
  var numFalse = question.responses.negative;
  var percentTrue = (((numTrue) /ttlResponses) * 100).toFixed(2);
  var percentFalse = (((numFalse) /ttlResponses) * 100).toFixed(2);
  return {positive: percentTrue, negative: percentFalse};
}

function parseCourseObject(course, curCourse, fromDate, toDate, timeStampNow, callback){

  var comMetQs = {
    q1: "*ubject*atter*",
    q2: "*dentified*ctions*",
    q3: "*nformation*resented*learly*",
    q4: "*atisfied*verall*", 
    q5: "*earning*bjectives*",
  };

  course.courseId = curCourse.id;
  course.courseName = curCourse.name;
  course.visible = curCourse.visible;
  course.courseStartDate = curCourse.startdate;
  course.reportingPeriodFrom = fromDate;
  course.reportingPeriodTo = toDate;
  course.timeStamp = timeStampNow;
  course.subjectMatter = new questionResponse();
  course.actionsToApply = new questionResponse();
  course.clearlyPresented = new questionResponse();
  course.overallSatisfaction = new questionResponse();
  course.learningObejectivesMet = new questionResponse();
  
  if (curCourse.fbQs){
    for (var j = 0; j < curCourse.fbQs.length; j++) {
      var fbQ = curCourse.fbQs[j];
       
      if (regexMatch(fbQ.question, comMetQs.q1)){
        var q = course.subjectMatter; // q as in question
        
       } else if (regexMatch(fbQ.question, comMetQs.q2)){
        var q = course.actionsToApply;

       } else if (regexMatch(fbQ.question, comMetQs.q3)){
        var q = course.clearlyPresented;

       } else if (regexMatch(fbQ.question, comMetQs.q4)){
        var q = course.overallSatisfaction;

       } else if (regexMatch(fbQ.question, comMetQs.q5)){
        var q = course.learningObejectivesMet;
      }

      q.itemPresent = true;
      q.question = fbQ.question;
      q.numStrongDis = fbQ.responses.stronglyDisagree;
      q.percentStrongDis = (Number(Math.round((fbQ.responses.stronglyDisagree / fbQ.numResponses)+'e2')+'e-2')).toFixed(2);
      q.numDis = fbQ.responses.disagree;
      q.percentDis = (Number(Math.round((fbQ.responses.disagree / fbQ.numResponses)+'e2')+'e-2')).toFixed(2);
      q.numNeutral = fbQ.responses.neutral;
      q.percentNeutral = (Number(Math.round((fbQ.responses.neutral / fbQ.numResponses)+'e2')+'e-2')).toFixed(2);
      q.numAgree = fbQ.responses.agree;
      q.percentAgree = (Number(Math.round((fbQ.responses.agree / fbQ.numResponses)+'e2')+'e-2')).toFixed(2);
      q.numStrongAgree = fbQ.responses.stronglyAgree;
      q.percentStrongAgree = (Number(Math.round((fbQ.responses.stronglyAgree / fbQ.numResponses)+'e2')+'e-2')).toFixed(2);
      q.numTotal = fbQ.numResponses;
    }
  } 

  // Supposedly, the total number of responses on one of the question objects should be equal to the other four, so...
  course.numResponses = course.subjectMatter.numTotal;

  var query = getQuery("enrolleeData", course.courseId);

  if (query)

   {
    var studentsList = [];

    queryDB(query, function(err, results){
      if (err) throw err;

      course.numTrained = 0;

      for (var m = 0; m < results.length; m++){ 

        if( (studentsList.indexOf(results[m].UserID) < 0) && (results[m].UserID != 0) ){

            var enrollDate = new Date(results[m].dateTime); // for some reason this date is in seconds and not milliseconds, thanks moodle
            if (enrollDate >= new Date(fromDate) && enrollDate <= new Date(toDate)){
               studentsList.push(results[m].UserID);
            }
        }
      }
       course.numTrained = studentsList.length;
      //console.log(course.numTrained);
      // var durationQuery = getQuery("courseDuration", course.courseId);
      // queryDB(durationQuery, function(err, hours){
      //  if (err) throw err;
      //     if (course.courseId = 64) {
      //       debugger;
      //     }
      //    if (hours != undefined) {
      //     course.durationHours = hours[0].printhours;
      //    } else {
      //     course.durationHours = 0;
      //    }
      // });

       //console.log("id",course.courseId);
       //console.log(course.numTrained);
      callback(null, course);
    });

  } else {
    course.numTrained = 0;
    course.durationHours = 0;
    callback(null, course);
  }
}


function regexMatch(str, rule){ return new RegExp("^" + rule.split("*").join(".*") + "$").test(str);
}


module.exports.getOneCourse = function(courseName, courseId, callback){
  CmCourse.find({courseName: courseName, courseId: courseId}, function(err, course){
    if (err) throw err;
    callback(null, course);
  });
};


module.exports.updateCourse = function(course, formData, callback){

  var courseInfo = {
    lps: formData.cmlps,
    dateOfTraining: formData.cmdateoftraining,
    contactName: formData.cmcontactname,
    durationHours: formData.cmdurhours,
    numTimesOffered: formData.cmnumtimesoffered,
    deliveryMode: formData.cmdeliverymode,
    primaryCompetency: formData.cmprimarycomp,
    courseDataCompleted: true
  };

   CmCourse.update({_id: course.id}, courseInfo, function(err, data){
    if (err) throw err;
    callback(null, data);
  });
};

module.exports.getCourses = function(ids, callback){
  CmCourse.find({'_id': {$in: ids}}, function(err, courses){
    if (err) throw err;
    callback(null, courses);
  });
};

module.exports.listCourses = function(ids, callback){
  CmCourse.find({
    '_id': { $in: ids}}, {courseName: 1, courseId: 1, courseDataCompleted: 1, visible: 1, reportingPeriodFrom: 1, reportingPeriodTo: 1,  _id: 1}, function(err, courses){
    if (err) throw err;
    callback(null, courses);
  });
};

module.exports.generateExcelFile = function(ids, callback){
  CmCourse.find({
    '_id': { $in: ids}}, function(err, courses){
    if (err) throw err;
    var wb = new xl.Workbook();
    var ws = wb.addWorksheet('Common Metrics Report');

    var styleRed = {
      font: {bold: true},
      alignment: {wrapText: true, horizontal: 'center'}, 
      fill: {type: 'pattern', patternType: 'solid', fgColor: 'F4CCCC'},
      border: {left: {style: 'thin', color: '000000'}, right: {style: 'thin', color: '000000'}, top: {style: 'thin', color: '000000'}, bottom: {style: 'thin', color: '000000'}}
    };

    var styleYellow = {
      font: {bold: true},
      alignment: {wrapText: true, horizontal: 'center'},
      fill: {type: 'pattern', patternType: 'solid', fgColor: 'FCE5CD'},
      border: {left: {style: 'thin', color: '000000'}, right: {style: 'thin', color: '000000'}, top: {style: 'thin', color: '000000'}, bottom: {style: 'thin', color: '000000'}}
    };

    var styleBlue = {
      font: {bold: true},
      alignment: {wrapText: true, horizontal: 'center'},
      fill: {type: 'pattern', patternType: 'solid', fgColor: 'DEEAF6'},
      border: {left: {style: 'thin', color: '000000'}, right: {style: 'thin', color: '000000'}, top: {style: 'thin', color: '000000'}, bottom: {style: 'thin', color: '000000'}}
    };

    var styleNoColorTitle = {
      font: {bold: true},
      alignment: {wrapText: true, horizontal: 'center'},
      border: {left: {style: 'thin', color: '000000'}, right: {style: 'thin', color: '000000'}, top: {style: 'thin', color: '000000'}, bottom: {style: 'thin', color: '000000'}}
    };

    var styleNoColorData = {
      alignment: {wrapText: true, horizontal: 'center'}
    };

    var stylePercentages = {
      numberFormat: '#.00%; -#.00%; -'
    };

    var styleMissingData = {
      fill: {type: 'pattern', patternType: 'solid', fgColor: 'FFD9D9'}
    };

    // SECTION TITLES
      ws.cell(1, 1, 1, 5, true).string('Reporting Information').style(styleRed);
      ws.cell(1, 6, 1, 11, true).string('CourseInformation').style(styleYellow);
      ws.cell(1, 12, 1, 21, true).string('Q1: Subject Matter Understanding Improved').style(styleBlue);
      ws.cell(1, 22, 1, 31, true).string('Q2: Identified Actions to Apply Information').style(styleBlue);
      ws.cell(1, 32, 1, 41, true).string('Q3: Information Was Presented Clearly').style(styleBlue);
      ws.cell(1, 42, 1, 51, true).string('Q4: Overall Satisfaction').style(styleBlue);
      ws.cell(1, 52, 1, 61, true).string('Q5: Learning Objecties Were Met').style(styleBlue);
      ws.cell(1, 62, 1, 63, true).string('Common Metrics Data Collected?').style(styleYellow);

    // INPUTED USER DATA
      ws.cell(2, 1).string("Which LPS Organized Training?").style(styleRed);
      ws.cell(2, 2).string("Reporting Period FROM:").style(styleRed);
      ws.cell(2, 3).string("Reporting Period TO:").style(styleRed);
      ws.cell(2, 4).string("Full name we may contact about data").style(styleRed);
      ws.cell(2, 5).string("Date (Live Training Only)").style(styleRed);
      ws.cell(2, 6).string("Course Title").style(styleYellow);
      ws.cell(2, 7).string("Core Competency Domain").style(styleYellow);
      ws.cell(2, 8).string("Delivery Mode Used to Offer Course").style(styleYellow);
      ws.cell(2, 9).string("Duration of Course in Hours").style(styleYellow);
      ws.cell(2, 10).string("Total # Completing Course").style(styleYellow);
      ws.cell(2, 11).string("Total # Completing Evaluation").style(styleYellow);

    // SUBJECT MATTER
      ws.cell(2, 12).string("# Strongly Disagree").style(styleBlue);
      ws.cell(2, 13).string("% Strongly Disagree").style(styleBlue);
      ws.cell(2, 14).string("# Disagree").style(styleBlue);
      ws.cell(2, 15).string("% Disagree").style(styleBlue);
      ws.cell(2, 16).string("# Neutral").style(styleBlue);
      ws.cell(2, 17).string("% Neutral").style(styleBlue);
      ws.cell(2, 18).string("# Agree").style(styleBlue);
      ws.cell(2, 19).string("% Agree").style(styleBlue);
      ws.cell(2, 20).string("# Strongly Agree").style(styleBlue);
      ws.cell(2, 21).string("% Strongly Agree").style(styleBlue);

    // ACTIONS TO APPLY
      ws.cell(2, 22).string("# Strongly Disagree").style(styleNoColorTitle);
      ws.cell(2, 23).string("% Strongly Disagree").style(styleNoColorTitle);
      ws.cell(2, 24).string("# Disagree").style(styleNoColorTitle);
      ws.cell(2, 25).string("% Disagree").style(styleNoColorTitle);
      ws.cell(2, 26).string("# Neutral").style(styleNoColorTitle);
      ws.cell(2, 27).string("% Neutral").style(styleNoColorTitle);
      ws.cell(2, 28).string("# Agree").style(styleNoColorTitle);
      ws.cell(2, 29).string("% Agree").style(styleNoColorTitle);
      ws.cell(2, 30).string("# Strongly Agree").style(styleNoColorTitle);
      ws.cell(2, 31).string("% Strongly Agree").style(styleNoColorTitle);

    // CLEARLY PRESENTED
      ws.cell(2, 32).string("# Strongly Disagree").style(styleBlue);
      ws.cell(2, 33).string("% Strongly Disagree").style(styleBlue);
      ws.cell(2, 34).string("# Disagree").style(styleBlue);
      ws.cell(2, 35).string("% Disagree").style(styleBlue);
      ws.cell(2, 36).string("# Neutral").style(styleBlue);
      ws.cell(2, 37).string("% Neutral").style(styleBlue);
      ws.cell(2, 38).string("# Agree").style(styleBlue);
      ws.cell(2, 39).string("% Agree").style(styleBlue);
      ws.cell(2, 40).string("# Strongly Agree").style(styleBlue);
      ws.cell(2, 41).string("% Strongly Agree").style(styleBlue);

    // OVERALL SATISFACTION
      ws.cell(2, 42).string("# Strongly Disagree").style(styleNoColorTitle);
      ws.cell(2, 43).string("% Strongly Disagree").style(styleNoColorTitle);
      ws.cell(2, 44).string("# Disagree").style(styleNoColorTitle);
      ws.cell(2, 45).string("% Disagree").style(styleNoColorTitle);
      ws.cell(2, 46).string("# Neutral").style(styleNoColorTitle);
      ws.cell(2, 47).string("% Neutral").style(styleNoColorTitle);
      ws.cell(2, 48).string("# Agree").style(styleNoColorTitle);
      ws.cell(2, 49).string("% Agree").style(styleNoColorTitle);
      ws.cell(2, 50).string("# Strongly Agree").style(styleNoColorTitle);
      ws.cell(2, 51).string("% Strongly Agree").style(styleNoColorTitle);

    // LEARNING OBJECTIVES MET
      ws.cell(2, 52).string("# Strongly Disagree").style(styleBlue);
      ws.cell(2, 53).string("% Strongly Disagree").style(styleBlue);
      ws.cell(2, 54).string("# Disagree").style(styleBlue);
      ws.cell(2, 55).string("% Disagree").style(styleBlue);
      ws.cell(2, 56).string("# Neutral").style(styleBlue);
      ws.cell(2, 57).string("% Neutral").style(styleBlue);
      ws.cell(2, 58).string("# Agree").style(styleBlue);
      ws.cell(2, 59).string("% Agree").style(styleBlue);
      ws.cell(2, 60).string("# Strongly Agree").style(styleBlue);
      ws.cell(2, 61).string("% Strongly Agree").style(styleBlue);

    // DATA RECORDED
      ws.cell(2, 62).string("Common Metrics Data Collected?").style(styleYellow);
      ws.cell(2, 63).string("If not, why?").style(styleYellow);
    
    var row = 3;
    
    for (var i = 0; i < courses.length; i++){
      var c = courses[i];
      c = validateData(c);


 
      // INPUTED USER DATA
        ws.cell(row, 1).string(c.lps).style(styleNoColorData);
        ws.cell(row, 2).date(new Date(c.reportingPeriodFrom)).style(styleNoColorData);
        ws.cell(row, 3).date(new Date(c.reportingPeriodTo)).style(styleNoColorData);
        ws.cell(row, 4).string(c.contactName).style(styleNoColorData);
        
        if (c.dateOfTraining) {
          ws.cell(row, 5).date(new Date(c.dateOfTraining)).style(styleNoColorData);
        } else {
          ws.cell(row, 5).string("NONE").style(styleNoColorData);
        }
        
        ws.cell(row, 6).string(c.courseName);
        ws.cell(row, 7).string(c.primaryCompetency).style(styleNoColorData);
        ws.cell(row, 8).string(c.deliveryMode).style(styleNoColorData);
        ws.cell(row, 9).number(c.durationHours);
        ws.cell(row, 10).number(c.numTrained);
        ws.cell(row, 11).number(c.numResponses);

      // SUBJECT MATTER
        ws.cell(row, 12).number(c.subjectMatter.numStrongDis);
        ws.cell(row, 13).number(c.subjectMatter.percentStrongDis).style(stylePercentages);
        ws.cell(row, 14).number(c.subjectMatter.numDis);
        ws.cell(row, 15).number(c.subjectMatter.percentDis).style(stylePercentages);
        ws.cell(row, 16).number(c.subjectMatter.numNeutral);
        ws.cell(row, 17).number(c.subjectMatter.percentNeutral).style(stylePercentages);
        ws.cell(row, 18).number(c.subjectMatter.numAgree);
        ws.cell(row, 19).number(c.subjectMatter.percentAgree).style(stylePercentages);
        ws.cell(row, 20).number(c.subjectMatter.numStrongAgree);
        ws.cell(row, 21).number(c.subjectMatter.percentStrongAgree).style(stylePercentages);

      // ACTIONS TO APPLY
        ws.cell(row, 22).number(c.actionsToApply.numStrongDis);
        ws.cell(row, 23).number(c.actionsToApply.percentStrongDis).style(stylePercentages);
        ws.cell(row, 24).number(c.actionsToApply.numDis);
        ws.cell(row, 25).number(c.actionsToApply.percentDis).style(stylePercentages);
        ws.cell(row, 26).number(c.actionsToApply.numNeutral);
        ws.cell(row, 27).number(c.actionsToApply.percentNeutral).style(stylePercentages);
        ws.cell(row, 28).number(c.actionsToApply.numAgree);
        ws.cell(row, 29).number(c.actionsToApply.percentAgree).style(stylePercentages);
        ws.cell(row, 30).number(c.actionsToApply.numStrongAgree);
        ws.cell(row, 31).number(c.actionsToApply.percentStrongAgree).style(stylePercentages);

      // CLEARLY PRESENTED
        ws.cell(row, 32).number(c.clearlyPresented.numStrongDis);
        ws.cell(row, 33).number(c.clearlyPresented.percentStrongDis).style(stylePercentages);
        ws.cell(row, 34).number(c.clearlyPresented.numDis);
        ws.cell(row, 35).number(c.clearlyPresented.percentDis).style(stylePercentages);
        ws.cell(row, 36).number(c.clearlyPresented.numNeutral);
        ws.cell(row, 37).number(c.clearlyPresented.percentNeutral).style(stylePercentages);
        ws.cell(row, 38).number(c.clearlyPresented.numAgree);
        ws.cell(row, 39).number(c.clearlyPresented.percentAgree).style(stylePercentages);
        ws.cell(row, 40).number(c.clearlyPresented.numStrongAgree);
        ws.cell(row, 41).number(c.clearlyPresented.percentStrongAgree).style(stylePercentages);

      // OVERALL SATISFACTION
        ws.cell(row, 42).number(c.overallSatisfaction.numStrongDis);
        ws.cell(row, 43).number(c.overallSatisfaction.percentStrongDis).style(stylePercentages);
        ws.cell(row, 44).number(c.overallSatisfaction.numDis);
        ws.cell(row, 45).number(c.overallSatisfaction.percentDis).style(stylePercentages);
        ws.cell(row, 46).number(c.overallSatisfaction.numNeutral);
        ws.cell(row, 47).number(c.overallSatisfaction.percentNeutral).style(stylePercentages);
        ws.cell(row, 48).number(c.overallSatisfaction.numAgree);
        ws.cell(row, 49).number(c.overallSatisfaction.percentAgree).style(stylePercentages);
        ws.cell(row, 50).number(c.overallSatisfaction.numStrongAgree);
        ws.cell(row, 51).number(c.overallSatisfaction.percentStrongAgree).style(stylePercentages);

      // LEARNING OBJECTIVES MET
        ws.cell(row, 52).number(c.learningObejectivesMet.numStrongDis);
        ws.cell(row, 53).number(c.learningObejectivesMet.percentStrongDis).style(stylePercentages);
        ws.cell(row, 54).number(c.learningObejectivesMet.numDis);
        ws.cell(row, 55).number(c.learningObejectivesMet.percentDis).style(stylePercentages);
        ws.cell(row, 56).number(c.learningObejectivesMet.numNeutral);
        ws.cell(row, 57).number(c.learningObejectivesMet.percentNeutral).style(stylePercentages);
        ws.cell(row, 58).number(c.learningObejectivesMet.numAgree);
        ws.cell(row, 59).number(c.learningObejectivesMet.percentAgree).style(stylePercentages);
        ws.cell(row, 60).number(c.learningObejectivesMet.numStrongAgree);
        ws.cell(row, 61).number(c.learningObejectivesMet.percentStrongAgree).style(stylePercentages);

      // DATA RECORDED
      if (c.numResponses > 0){
        ws.cell(row, 62).bool(true).style(styleNoColorData);
      } else {
        ws.cell(row, 62).bool(false).style(styleNoColorData);
        ws.cell(row, 1, row, 62).style(styleMissingData);
      }

      row += 1;
    }

    var fileName = "commonMetricsReport.xlsx";
    wb.write(fileName);
    callback(null, fileName);
  });
};

function validateData(course){ 
  // If questions are not present in the database, or not present during the requested timeframe 

  if (course.subjectMatter.itemPresent == false) {
    course.subjectMatter.numStrongDis = 0;
    course.subjectMatter.percentStrongDis = 0;
    course.subjectMatter.numDis = 0;
    course.subjectMatter.percentDis = 0;
    course.subjectMatter.numNeutral = 0;
    course.subjectMatter.percentNeutral = 0;
    course.subjectMatter.numAgree = 0;
    course.subjectMatter.percentAgree = 0;
    course.subjectMatter.numStrongAgree = 0;
    course.subjectMatter.percentStrongAgree = 0;
    course.subjectMatter.numTotal = 0;
  }

  if (course.actionsToApply.itemPresent == false) {
    course.actionsToApply.numStrongDis = 0;
    course.actionsToApply.percentStrongDis = 0;
    course.actionsToApply.numDis = 0;
    course.actionsToApply.percentDis = 0;
    course.actionsToApply.numNeutral = 0;
    course.actionsToApply.percentNeutral = 0;
    course.actionsToApply.numAgree = 0;
    course.actionsToApply.percentAgree = 0;
    course.actionsToApply.numStrongAgree = 0;
    course.actionsToApply.percentStrongAgree = 0;
    course.actionsToApply.numTotal = 0;
  }

  if (course.overallSatisfaction.itemPresent == false) {
    course.overallSatisfaction.numStrongDis = 0;
    course.overallSatisfaction.percentStrongDis = 0;
    course.overallSatisfaction.numDis = 0;
    course.overallSatisfaction.percentDis = 0;
    course.overallSatisfaction.numNeutral = 0;
    course.overallSatisfaction.percentNeutral = 0;
    course.overallSatisfaction.numAgree = 0;
    course.overallSatisfaction.percentAgree = 0;
    course.overallSatisfaction.numStrongAgree = 0;
    course.overallSatisfaction.percentStrongAgree = 0;
    course.overallSatisfaction.numTotal = 0;
  }

  if (course.clearlyPresented.itemPresent == false) {
    course.clearlyPresented.numStrongDis = 0;
    course.clearlyPresented.percentStrongDis = 0;
    course.clearlyPresented.numDis = 0;
    course.clearlyPresented.percentDis = 0;
    course.clearlyPresented.numNeutral = 0;
    course.clearlyPresented.percentNeutral = 0;
    course.clearlyPresented.numAgree = 0;
    course.clearlyPresented.percentAgree = 0;
    course.clearlyPresented.numStrongAgree = 0;
    course.clearlyPresented.percentStrongAgree = 0;
    course.clearlyPresented.numTotal = 0;
  }

  if (course.learningObejectivesMet.itemPresent == false) {
    course.learningObejectivesMet.numStrongDis = 0;
    course.learningObejectivesMet.percentStrongDis = 0;
    course.learningObejectivesMet.numDis = 0;
    course.learningObejectivesMet.percentDis = 0;
    course.learningObejectivesMet.numNeutral = 0;
    course.learningObejectivesMet.percentNeutral = 0;
    course.learningObejectivesMet.numAgree = 0;
    course.learningObejectivesMet.percentAgree = 0;
    course.learningObejectivesMet.numStrongAgree = 0;
    course.learningObejectivesMet.percentStrongAgree = 0;
    course.learningObejectivesMet.numTotal = 0;
  }

  return course;
}


module.exports.saveCoursesToUserReport = function(reportName, reportType, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, callback){
  CmCourse.find({reportName: reportName, reportOwner: reportOwner}, {_id: 1}, function(err, reportData){
    if (err) throw err;
   
    UserReport.createReport(reportName, reportType, reportData, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, function(err, data){
      if (err) throw err;
      callback(null, data);
    });
  });
};

module.exports.deleteCourses = function(ids, callback){
  CmCourse.remove({'_id': {$in: ids}}, function(err, data){
    if (err) throw err;
    callback(null, data);
  });
};