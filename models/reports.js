
// this for generating report where report type is not defined
var mysql = require('mysql');
require('datejs');
require('dotenv').config();
var util = require('util');
 
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

var Reporter = module.exports;

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

function regexAndScoreProcessing(course, curCourse){
  
  if (regexMatch(curCourse.itemName, '*re*est*')){ //Should really have better naming conventions for pre and post tests
    course.preScores.push(curCourse.grade);
    course.preTestCount = course.preScores.length;
    course.preMax = course.preScores.max();
    course.preMin = course.preScores.min();
    course.preAverage = getAvg(course.preScores).toFixed(2);
  
  } else if (regexMatch(curCourse.itemName, '*ost*est*')){
    course.postScores.push(curCourse.grade);
    course.postTestCount = course.postScores.length;
    course.postMax = course.postScores.max();
    course.postMin = course.postScores.max();
    course.postAverage = getAvg(course.postScores).toFixed(2);
  }

  return course;
}


//useful function***********************************
function getQuery(reportType){
  if (reportType == "audit") {
    return "SELECT c.fullname AS 'courseName', g.name AS 'groupName', gm.userid AS 'userID', FROM_UNIXTIME(gm.timeadded, '%Y-%m-%d') AS 'dateTime' FROM mdl_groups g  JOIN mdl_groups_members AS gm ON g.id = gm.groupid JOIN mdl_course AS c ON g.courseid = c.id WHERE (g.name LIKE '%udit%')";
  
  } else if (reportType == "feedback") {

    return "SELECT c.fullname AS 'courseName', fb.course AS 'courseId', fb.id AS 'courseFbSetId', fbc.id AS 'submissionId', FROM_UNIXTIME(fbc.timemodified, '%Y-%m-%d') AS 'dateTime', fbc.userid AS 'userId', fbi.id AS 'questionId', fbi.name AS 'question', fbi.presentation AS 'label', fbv.value AS 'response' FROM mdl_feedback as fb JOIN mdl_feedback_item AS fbi ON fb.id = fbi.feedback JOIN mdl_feedback_value AS fbv ON fbi.id = fbv.item JOIN mdl_feedback_completed AS fbc ON fbv.completed = fbc.id JOIN mdl_course AS c ON fb.course = c.id ORDER BY fb.id, CourseId;";
  
  } else if (reportType == "grades") {
    return "select gg.userid AS 'userId', gi.courseid AS 'courseId',c.fullname AS 'courseName', gi.itemname AS 'itemName', ROUND (gg.finalgrade, 2) AS 'grade', DATE_FORMAT(FROM_UNIXTIME(gg.timemodified), '%Y-%m-%d') AS 'dateTime' from mdl_grade_grades as gg join mdl_grade_items as gi on gg.itemid = gi.id join mdl_course as c on gi.courseid = c.id join mdl_user as u on gg.userid = u.id WHERE (gi.itemname LIKE '%re%est%' OR gi.itemname LIKE'%ost%est%') and gg.finalgrade is not NULL ORDER BY courseId ASC, dateTime ASC, userId ASC";

  
  } else if (reportType == "ehbUsers") {
    return "SELECT u.firstname, u.lastname, uid.userid, uid.fieldid, uid.data, uif.name FROM mdl_user_info_data AS uid JOIN mdl_user_info_field AS uif ON uid.fieldid = uif.id JOIN mdl_user AS u ON uid.userid = u.id ORDER BY uid.userid ASC;";

  } else if (reportType == "ehbCourses") {
    return "SELECT e.courseid, DATE_FORMAT(FROM_UNIXTIME(ue.timestart), '%Y-%m-%d') AS 'dateTime', ue.userid, c.fullname FROM mdl_enrol AS e JOIN mdl_user_enrolments AS ue ON e.id = ue.enrolid JOIN mdl_course AS c ON e.courseid = c.id ORDER BY e.courseid ASC, ue.userid DESC;";
  
  } else {
    return null;
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

/*function filterOneResult(fromDate, toDate, record){
  var begDate = new Date(fromDate);
  var endDate = new Date(toDate);
  var recordDate = new Date(record.dateTime);
  if (begDate > recordDate || recordDate > endDate) {
    return null;
  } else {
    return record;
  }
}*/

//Useful function*********************************
function runAnalysis(results, reportType){
  if (reportType == "audit") {
    return auditEnrollmentAnalysis(results);
  
  } else if (reportType == "grades") {
    return gradeAnalysis(results);

  } else if (reportType == "feedback") {
    return feedbackAnalysis(results);
  
  } else if (reportType == "fullmetrics") {
    return fullMetricAnalysis(results);
  }

}




//Useful function**********************************************
function gradeAnalysis(data){
  // data is an arrary of objects each of which includes: userId, courseId, courseName, grade, and graded(as a date)
  var courseList = [];
  var courseids = [];
  var undeterminedObjects = [];

  function AggregateCourseGrades(name, id) { // Set up object ACG = Aggregate Course Grades object
    this.name = name;
    this.id = id;
    this.preScores = [];
    this.postScores = [];
    this.preTestCount = 0;
    this.postTestCount = 0;
    this.preMax = 0;
    this.postMax = 0;
    this.preMin = 0;
    this.postMin = 0;
    this.preAverage = 0;
    this.postAverage = 0;
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

  data = {courses: courseList, undetermined: undeterminedObjects}
  return data;
}

module.exports.getReport = function(fromDate, toDate, reportType, callback){

  if (reportType == "ehb"){
    ehbReport(fromDate, toDate, function(err, results){ // have a different function for this report type, since its more complicated
      if(err) throw err;
      var report = {data: results, reportType: reportType, fromDate: fromDate, toDate: toDate};
      callback(err, report);
    });

  } else {
    var query = getQuery(reportType);
    if (query) { 
    var results;
    
    queryDB(query, function(err, results){
      if (err) throw err;
      
    
      results = filterResults(fromDate, toDate, results);
      
      if (results) {
        var data = runAnalysis(results, reportType);
        var report = {data: data, reportType: reportType, fromDate: fromDate, toDate: toDate};
        callback(null, report);
      
      } else {
        err = new Error('Invalid Date Range');
        results = "There was an error, please try again";
        callback(err, results);
      }
    });
    
    } else {
      var err = new Error('Invalid Report Type');
      var results = "There was an error, plase try again";
      callback(err, results);
    }

  }
};

module.exports.customReport = function(fromDate, toDate, tables, callback){
  // TODO: Process a custom query somehow
  var results = "There is nothing here yet";
  callback(null, results);
};

module.exports.showFullData = function(fromDate, toDate, reportType, callback){
  // TODO: Create process for loading all the requested data in a usable way
  var results = "Nothing so far";
  callback(null, results);
};
/*function feedbackAnalysis(data){
  var coursesList = [];
  var courseids = [];
  var questionids = [];

  function ACF(name, id) { //ACF = Aggregate Course Feedback; For each course compile all question objects
    this.name = name;
    this.id = id;
    this.fbQs =[];
    this.fbQIds = [];
  }

  function AQR(fbSetId, questionId, question){ // AQR = Aggregate Question Responses; For each question, record all responses
    this.setId = fbSetId;
    this.id = questionId;
    this.question = question;
    this.qType = '';
    this.responses;
    this.numResponses = 0;
    this.avgResponse = 0;
  }

  for (var i = 0; i < data.length; i++){

    var curQuestion = data[i];

    if (relevantQuestion(curQuestion.question)){

      if (courseids.indexOf(curQuestion.courseId) < 0) { // If the course does not yet exist, create a new course
        var course = new ACF(curQuestion.courseName, curQuestion.courseId); // Make course and question objects
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
        var course = coursesList.find(c => c.id === id); // Set course object to the current question's course

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

function fullMetricAnalysis(data){
  // TODO: Find out what feilds are needed to be aggregated in total for the full metrics
  // TODO: After getting the needed information, calculate the needed statistics
  return data;
}

function parseInfoEHB(student, fieldid, data){
  // Predefined fieldids from moodle database make this annoying, but whatever
  if (fieldid == 1){ // State
    student.state = data;
  } else if (fieldid == 2){ // Organization Name
    student.orgName = data;
  } else if (fieldid == 3){ // Profession, primary area of work or study
    student.profession = data;
  } else if (fieldid == 4){ // Where do you practice?
    student.practice = data;
  } else if (fieldid == 5){ // Organization a primary care setting?
    student.primaryCare = data;
  } else if (fieldid == 6){ // Is it medically underserved?
    student.underServedCom = data;
  } else if (fieldid == 7){ // Is it in a rural area?
    student.ruralArea = data;
  } else if (fieldid == 8){ // Years in public health practice
    student.numYearsAtPractice = data;
  } else if (fieldid == 9){ // City
    student.city = data;
  } else if (fieldid == 10){ // Country
    student.country = data;
  } else if (fieldid == 11){ // If listed other as profession, what is your profession?
    student.otherProf = data;
  }
  
  return student;
}

function enrollmentProcessing(course, student){

  if((student) && (course.students.indexOf(student.id) < 0)){ // Ensure student exists and only has one enrollment per course 
    course.students.push(student.id);

    if (student.primaryCare == "yes" || student.primaryCare == true){
      course.numTrainedPrimaryCare += 1;
    }

    if (student.underServedCom == "yes" || student.underServedCom == true){
      course.numMedUnderServed += 1;
    }

    if (student.ruralArea == "yes" || student.ruralArea == true){
      course.numRuralArea += 1;
    }

    var sid = student.id;
    var profession = student.profession;
    var studentProfessionInfo = {id: sid, profession: profession};
    course.professions.push(studentProfessionInfo);
  
  }

  return course;
}

function listTopProfessions(course, professionsList){

  var topProfessions = {};

  for (var k = 0; k < professionsList.length; k++) {
   topProfessions[professionsList[k]] = (topProfessions[professionsList[k]] || 0) + 1;
  }

  for (var prof in topProfessions) {
    if (topProfessions.hasOwnProperty(prof)) {
      var curProf = topProfessions[prof];

    }
  }
  
  profSorted = Object.keys(topProfessions).sort(function(a,b){
    return topProfessions[a]-topProfessions[b];
  });

  profSorted = profSorted.reverse();

  for (var k = 0; k < 6; k++){
    if(profSorted[k]){
      course.sortedProfessions[k] = {profession: profSorted[k], count: topProfessions[profSorted[k]]};
    } else {
      course.sortedProfessions[k] = {profession: "None", count: "0"};
    }
  }

  if (profSorted.length > 7){
    var count = 0;
    for (var k = 7; k < profSorted.length; k++){
      count = count + topProfessions[profSorted[k]];
    }
    course.sortedProfessions[6] = {profession: "Remaining Professions", count: count};
  } else {
    course.sortedProfessions[6] = {profession: "Remaining Professions", count: 0};
  }

  return course;
}

function sumProfessions(courses){

  for (var i = 0; i < courses.length; i++){
    var course = courses[i];
    var professionsList = [];

    for (var j = 0; j < course.professions.length; j++){
      professionsList.push(course.professions[j].profession);   
    }

    course = listTopProfessions(course, professionsList);
  }

  return courses;
}

function indexStudents(data){
  var studentIds = [];
  var studentsList = [];

  function Student(id, firstname, lastname) {
    this.id = id;
    this.name  = firstname + " " + lastname;
    this.state = '';
    this.orgName = '';
    this.profession = '';
    this.practice = '';
    this.primaryCare = '';
    this.underServedCom = '';
    this.ruralArea = '';
    this.numYearsAtPractice = '';
    this.city = '';
    this.country = '';
    this.otherProf = '';
  }

  for (var i = 0; i < data.length; i++){
      var record = data[i];
      if (studentIds.indexOf(record.userid) < 0){
        student = new Student(record.userid, record.firstname, record.lastname);
        student = parseInfoEHB(student, record.fieldid, record.data);
        studentsList.push(student);
        studentIds.push(student.id);
      } else if (record.userid == student.id) {
        student = parseInfoEHB(student, record.fieldid, record.data);
      } else if ((studentIds.indexOf(record.userid) >= 0) && (record.userid != student.id)){
        var sid = record.userid;
        student = studentsList.find(s => s.id === sid);
        student = parseInfoEHB(student, record.fieldid, record.data);
      }
    }

  return studentsList;
}*/

/*function indexCoursesWithEnrolledStudents(data, studentsList, fromDate, toDate){
  var courseIds = [];
  var coursesList = [];

  function courseEnrollment(name, id){
    this.id = id;
    this.name = name;
    this.students = [];
    this.numTrainedPrimaryCare = 0;
    this.numMedUnderServed = 0;
    this.numRuralArea = 0;
    this.numTrainedByCourse = this.students.length;
    this.professions = [];
    this.sortedProfessions = [];
  }

  for(var i = 0; i < data.length; i++){
    var record = filterOneResult(fromDate, toDate, data[i]);
    if (record) {
      if (courseIds.indexOf(record.courseid) < 0){
        course = new courseEnrollment(record.fullname, record.courseid);
        var sid = record.userid;
        student = studentsList.find(u => u.id === sid);
        course = enrollmentProcessing(course, student);
        courseIds.push(course.id);
        coursesList.push(course);
      } else if ((courseIds.indexOf(record.courseid) >= 0) && (record.courseid != course.id)){
        var cid = record.courseId;
        course = coursesList.find(c => c.id === cid);
        var sid = record.userid;
        student = studentsList.find(u => u.id === sid);
        course = enrollmentProcessing(course, student);
      } else {
        var sid = record.userid;
        student = studentsList.find(u => u.id === sid);
        course = enrollmentProcessing(course, student);
      }
    }
  }
  return coursesList;
}
*/
/*function ehbReport(fromDate, toDate, callback){
  var studentsList;
  var coursesList;

  var query = getQuery("ehbUsers");
  queryDB(query, function(err, data){
    if (err) throw err;
    studentsList = indexStudents(data);

    query = getQuery("ehbCourses");
    queryDB(query, function(err, data){
      if (err) throw err;
      coursesList = indexCoursesWithEnrolledStudents(data, studentsList, fromDate, toDate);
      coursesList = sumProfessions(coursesList);
      callback(null, coursesList);
    });
  });
}*/
//Useful function to start the 'Pre and Post test report'

/*function getFbQType(question, label){
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
}*/

/*function relevantQuestion(question){

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

function feedbackProcessing(question, curQuestion){
  question = answerProcessing(question, curQuestion);
  question.numResponses += 1;
  return question;
}
*/
/*function answerProcessing(question, curQuestion){
  
  if (question.qType == "Rank"){
    if (curQuestion.response == '1'){
      question.responses.stronglyAgree += 1;
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
}*/

/*function getAverageFbRanked(question){
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
}*/

/*function getAverageFbTF(question){
  var ttlResponses = question.numResponses;
  var numTrue = question.responses.positive;
  var numFalse = question.responses.negative;
  var percentTrue = (((numTrue) /ttlResponses) * 100).toFixed(2);
  var percentFalse = (((numFalse) /ttlResponses) * 100).toFixed(2);
  return {positive: percentTrue, negative: percentFalse};
}*/

/*function auditEnrollmentAnalysis(data){
  var coursesList = [];
  var course;
  var counter = 0;

  function courseCounter(name){
    this.name = name;
    this.count = 0;
  }

  for (var i = 0; i < data.length; i++){
    var currentCourse = data[i].courseName;

    if (!course){
      var course = new courseCounter(currentCourse);
      course.count += 1;
    } else if (course.name == currentCourse) {
      course.count += 1;
    } else {
      coursesList.push(course);
      course = new courseCounter(currentCourse);
      course.count = 1;
    }
  }
  
  // Add Last course not covered by loop
  course.count += 1;
  coursesList.push(course);

  // Return parsed results;
  return coursesList;
}*/