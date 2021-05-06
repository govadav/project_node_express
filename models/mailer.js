var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var MailReportSchema = new Schema({
  formData: String
});

module.exports = mongoose.model('MailReport', MailReportSchema);