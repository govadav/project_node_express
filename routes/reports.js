//reports initialization starts here
var express = require("express"); 
var router = express.Router();

//defined all functions in the mentioned files so we need them to add them
var GradeReporter = require("../models/grades");
var EhbReport = require("../models/ehb");
var CmReport = require("../models/commonMetrics");
var UserReport = require("../models/userReports");
var AuditReport = require("../models/auditCourse");
var xl = require("excel4node");
var fs = require('fs');

// REPORTS HOME AND INITIAL VIEW
router.get('/index', ensureVerification, function(req, res){
  var id = req.user.id;
  // var userLMS = req.user.lms;
  var userLMS = "Global";
  var isAdmin = req.user.admin;
  UserReport.listAvailableReports(userLMS, id, isAdmin, function(err, reports){
    res.render('reportindex', {reports: reports, admin: isAdmin});
  });
});

// REPORTS FULL PAGE ARCHIVE
router.get('/allreports', ensureVerification, function(req, res){
  var id = req.user.id;
  // var userLMS = req.user.lms;
  var userLMS = "Global";
  var isAdmin = req.user.admin;
  UserReport.listAvailableReports(userLMS, id, isAdmin, function(err, reports){
    res.render('reportsList', {reports: reports, admin: isAdmin});
  });
});

// CREATE NEW REPORT
router.post('/report', ensureVerification, function(req, res){
  var reportType = req.body.reporttype;

  var reportName = req.body.reportName;
  var fromDate = req.body.fromdate;
  var toDate = req.body.todate;
  //var fromDate = new Date(2018, 6, 1);
//var toDate = new Date (2019, 5, 30);
  var reportOwner = req.user.id;
  var ownerFirst = req.user.firstname;
  var ownerLast = req.user.lastname;
  var reportLMS = "Global";
  var reportSharingOptions = req.body.sharingOptions;
  // var reportLMS = req.user.lms;
  
  //console.log(reportType);
  if (reportType == "ehb"){ 
    EhbReport.createCourses(fromDate, toDate, reportName, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, function(err, report){
      //console.log("EHB report", report);
      EhbReport.saveCoursesToUserReport(reportName, reportType, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, function(err, data){
        var reportId = data._id;
        if (err) throw err;
        UserReport.getCourseReportIds(reportName, reportOwner, function(err, ids){
          if (err) throw err;
          EhbReport.listCourses(ids, function(err, courses){

            if (err) throw err;
            res.render('ehbReportCreator', {toDate: toDate, fromDate: fromDate, reportId: reportId, courses: courses, reportName: reportName, returningToSaved: false });
          });
        });
      });
    });

  } else if (reportType == "commonMetrics") {
    CmReport.createCourses(fromDate, toDate, reportName, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, function(err, report){
      CmReport.saveCoursesToUserReport(reportName, reportType, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, function(err, data){
        var reportId = data._id;
        if (err) throw err;
        UserReport.getCourseReportIds(reportName, reportOwner, function(err, ids){
          if (err) throw err;
          CmReport.listCourses(ids, function(err, courses){
            if (err) throw err;
            res.render('commonMetrics', {reportId: reportId, courses: courses, reportName: reportName, fromDate: fromDate, toDate: toDate, returningToSave: false});
          });
        });
      });
    });
  } else if (reportType == "audit") {
    AuditReport.createCourses(fromDate, toDate, reportName, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, function(err, report){
      AuditReport.saveCoursesToUserReport(reportName, reportType, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, function(err, data){
        var reportId = data._id;
        if (err) throw err;
        UserReport.getCourseReportIds(reportName, reportOwner, function(err, ids){
          if (err) throw err;
          AuditReport.listCourses(ids, function(err, courses){
            if(err) throw err;
            res.render('auditReport', {reportId: reportId, courses: courses[0]._doc.coursesAndStudents, reportName: reportName, fromDate: fromDate, toDate: toDate, returningToSave: false});
          });
        });
      });
    });
  } else if(reportType == "grades"){
    //from here the function will be called in 'report' file and the report pulled was grades
    //console.log(reportType);
    GradeReporter.createCourses(fromDate, toDate, reportName, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, function(err, report){
        //console.log("report", report);
      GradeReporter.saveCoursesToUserReport(reportName, reportType, reportOwner, ownerFirst, ownerLast, reportLMS, reportSharingOptions, function(err, data){
        var reportId = data._id;
        if(err) throw err;
        UserReport.getCourseReportIds(reportName, reportOwner, function(err, ids){
          if(err) throw err;
          GradeReporter.listCourses(ids, function(err, courses){
            if(err) throw err;
            //console.log("courses", courses)
            res.render('report', {toDate: toDate, fromDate: fromDate, reportId: reportId, courses: courses, reportName: reportName, returningToSaved: false });
          });
        });
      });
    });
  }

});

// EDIT AND VIEW REPORTS and this function liks to 'Continuing working' button and 'Edit Report' button
router.get('/viewreport/:report_id', ensureVerification, function(req, res){
  UserReport.getReport(req.params.report_id, function(err, report){
    if (err) throw err;
    if (report.reportType == "ehb") {
      EhbReport.listCourses(report.reportData, function(err, courses){
        if (err) throw err;
        res.render('ehbReportCreator', {reportId: req.params.report_id, courses: courses});
      });
    } else if (report.reportType == "commonMetrics") {
      CmReport.listCourses(report.reportData, function(err, courses){
        if (err) throw err;
        res.render('commonMetrics', {reportId: req.params.report_id, courses: courses});
      });
    } else if (report.reportType == "audit") {
      AuditReport.listCourses(report.reportData, function(err, courses){
        if(err) throw err;
        res.render('auditReport', {reportId: req.params.report_id, courses: courses[0]._doc.coursesAndStudents});
      });
    } else if(report.reportType ==  "grades"){
      GradeReporter.listCourses(report.reportData, function(err, courses){
        if(err) throw err;
        res.render("report", {reportId: req.params.report_id, courses: courses});
      });
    }
  });
});

// DELTE REPORT
router.get('/deletereport/:report_id', ensureVerification, function(req, res){
  UserReport.getReport(req.params.report_id, function(err, report){
    if (err) throw err;

    if (report.reportType == "ehb"){
      EhbReport.deleteCourses(report.reportData, function(err, data){
        if (err) throw err;
        UserReport.deleteReport(req.params.report_id, function(err, data){
          res.redirect('/reports/index');
        });
      });

    } else if (report.reportType == "commonMetrics"){
      CmReport.deleteCourses(report.reportData, function(err, data){
        if (err) throw err;
        UserReport.deleteReport(req.params.report_id, function(err, data){
          res.redirect('/reports/index');
        });
      });

    } else if (report.reportType == "audit"){
      AuditReport.deleteCourses(report.reportData, function(err, data){
        if (err) throw err;
        UserReport.deleteReport(req.params.report_id, function(err, data){
          res.redirect('/reports/index');
        });
      });
    } else if(report.reportType == "grades"){
      GradeReporter.deleteCourses(report.reportData, function(err, data){
        if (err) throw err;
        UserReport.deleteReport(req.params.report_id, function(err, data){
          res.redirect('/reports/index');
        });
      });
    }

  });
});

// EHB -- GET SINGLE COURSE
router.get('/ehb/:course_id', ensureVerification, function(req, res) {
  EhbReport.findById(req.params.course_id, function(err, course) {
      if (err) {
        res.sendStatus(404);
        console.log(err);
      }
      res.send(course);
  });
});

// EHB -- UPDATE SINGLE COURSE
router.post('/ehb/:course_id', ensureVerification, function(req, res) {
  var data = req.body;
  EhbReport.findById(req.params.course_id, function(err, course) {
    if (err) throw err;

    EhbReport.updateCourse(course, data, function(err, response){
      if (err) throw err;
      res.sendStatus(200);
    });
  });
});

// COMMMON METRICS -- GET SINGLE COURSE
router.get('/commonmetrics/:course_id', ensureVerification, function(req, res) {
  CmReport.findById(req.params.course_id, function(err, course) {
      if (err) {
        res.sendStatus(404);
        console.log(err);
      }
      res.send(course);
  });
});

// COMMMON METRICS -- UPDATE SINGLE COURSE
router.post('/commonmetrics/:course_id', ensureVerification, function(req, res) {
  var data = req.body;
  CmReport.findById(req.params.course_id, function(err, course) {
    if (err) throw err;

    CmReport.updateCourse(course, data, function(err, response){
      if (err) throw err;
      res.sendStatus(200);
    });
  });
});

// PRE/POST -- GET SINGLE COURSE
router.get('/grades/:course_id', ensureVerification, function(req, res) {
  GradeReporter.findById(req.params.course_id, function(err, course) {
      if (err) {
        res.sendStatus(404);
        console.log(err);
      }
      res.send(course);
  });
});

// PRE/POST -- UPDATE SINGLE COURSE
router.post('/grades/:course_id', ensureVerification, function(req, res) {
  var data = req.body;
  //console.log(data);
  GradeReporter.findById(req.params.course_id, function(err, course) {
    if (err) throw err;

    GradeReporter.updateCourse(course, data, function(err, response){
      if (err) throw err;
      res.sendStatus(200);
    });
  });
});

// EXCEL GENERATOR
router.get('/generate-excel/:report_id', ensureVerification, function(req, res) {
  UserReport.getReport(req.params.report_id, function(err, report){
    if(err) throw err;

    if(report.reportType == "ehb") {
      EhbReport.generateExcelFile(report.reportData, function(err, fileName){
        setTimeout(function(){ // I don't know how else to do this right now, but it makes me cringe too don't worry
          if (fs.existsSync(fileName)) {
            res.download(fileName);
          } else {
            setTimeout(function(){
              if (fs.existsSync(fileName)) {
                res.download(fileName);
              } else {
                res.sendStatus(500);
              }
            }, 5000);
          }
        }, 3000);
      });

    } else if (report.reportType == "commonMetrics") {
      CmReport.generateExcelFile(report.reportData, function(err, fileName){
        setTimeout(function(){ // I don't know how else to do this right now, but it makes me cringe too don't worry
          if (fs.existsSync(fileName)) {
            res.download(fileName);
          } else {
            setTimeout(function(){
              if (fs.existsSync(fileName)) {
                res.download(fileName);
              } else {
                res.sendStatus(500);
              }
            }, 5000);
          }
        }, 3000);
      });

    } else if (report.reportType == "audit"){
      AuditReport.generateExcelFile(report.reportData, function(err, fileName){
        setTimeout(function(){ // I don't know how else to do this right now, but it makes me cringe too don't worry
          if (fs.existsSync(fileName)) {
            res.download(fileName);
          } else {
            setTimeout(function(){
              if (fs.existsSync(fileName)) {
                res.download(fileName);
              } else {
                res.sendStatus(500);
              }
            }, 5000);
          }
        }, 3000);
      });
    } else if(report.reportType == "grades"){
      GradeReporter.generateExcelFile(report.reportData, function(err, fileName){
        setTimeout(function(){ // I don't know how else to do this right now, but it makes me cringe too don't worry
          if (fs.existsSync(fileName)) {
            res.download(fileName);
          } else {
            setTimeout(function(){
              if (fs.existsSync(fileName)) {
                res.download(fileName);
              } else {
                res.sendStatus(500);
              }
            }, 5000);
          }
        }, 3000);
      });
    }
  });
});

// TABLE GENERATOR
router.get('/generate-table/:report_id', ensureVerification, function(req, res){
  UserReport.getReport(req.params.report_id, function(err, report){
    if (err) throw err;

    if (report.reportType == "ehb"){
      EhbReport.getCourses(report.reportData, function(err, data){
        res.render('ehbTable', {reportId: req.params.report_id, data: data});
      });
    } else if (report.reportType == "commonMetrics"){
      CmReport.getCourses(report.reportData, function(err, data){
        res.render('commonMetricsTable', {reportId: req.params.report_id, data: data});
      });
    } else if(report.reportType == "grades"){
      GradeReporter.getCourses(report.reportData, function(err, data){
        res.render('gradesTable', {reportId: req.params.report_id, data: data});
      });
    }
  });
});

// USER VERIFICATION
function ensureVerification(req, res, next){
  if(req.isAuthenticated()){
    if(req.user.access){
      next();
    } else {
      req.flash('error_msg', "You are not permitted to see this page.  Contact an administrator for access");
      res.redirect('/');
    }
    
  } else {
    req.flash('error_msg', 'You are not logged in.  Log in or register to continue.');
    res.redirect('/users/login');
  }
}

module.exports = router;  

