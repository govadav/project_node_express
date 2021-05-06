
module.exports = function(app){
  var module = {};

  function mkObj(ans, usr){
    if (usr) { // if there are answers
      var obj = {"ans": ans, "usrAns": usr, "correct": false};
      // check if user got answer correct
      if (Array.isArray(usr) && Array.isArray(ans)){// check violation codes; if arrays
        if (String(ans.sort()) == String(usr.sort())){
          obj.correct = true;
        }
      } else if (ans === usr) { // for all the other correct answers
        obj.correct = true;
      }
      return obj;
    }
    // if there are no answers
    var obj = {"ans": ans, "usrAns": "No Answer", "correct": false};
    return obj;
  }

  function combineKeys(ans, usr) {
    var comObj = {};
    comObj.violStructID = {"id": ans.violStructID};
    comObj.sceneName = {"id": ans.sceneName};
    comObj.indexNumber = {"id": ans.indexNumber};
    comObj.location = {"id": ans.location};

    if (!ans.codeId[0]){
      ans.codeId = "N/A";
    }

    if (usr) { // assumes user answered this set
      if (!usr.codeId[0]) {
        usr.codeId = "N/A";
      }

      //really it would be better to loop through this, but I can never seem to get it to work
      comObj.violYN = mkObj(ans.violYN, usr.violYN);
      comObj.codeId = mkObj(ans.codeId, usr.codeId);
      comObj.violDescUser = mkObj(ans.violDescUser, usr.violDescUser);
      comObj.endanger = mkObj(ans.endanger, usr.endanger);
      comObj.responsibleParty = mkObj(ans.responsibleParty, usr.responsibleParty);
      comObj.referral = mkObj(ans.referral, usr.referral);

      // Trying not to mark the free response wrong just because of textual mismatch
      comObj.violDescUser.correct = "Variable";
      return comObj;
    }

    // return empty user spaces if object does not exist
    comObj.violYN = mkObj(ans.violYN, null);
    comObj.codeId = mkObj(ans.codeId, null);
    comObj.violDescUser = mkObj(ans.violDescUser, null);
    comObj.endanger = mkObj(ans.endanger, null);
    comObj.responsibleParty = mkObj(ans.responsibleParty, null);
    comObj.referral = mkObj(ans.referral, null);
    
    return comObj;
  }

  module.getAnswers = function (answerKey, userAnswers){
    var combined = {};

    for (var i = 0; i < answerKey.length; i++){ // start loop through answer key
      var ans = answerKey[i];
      var match = false;
      for (var j = 0; j < userAnswers.length; j++){ // start loop through users answers
        var usr = userAnswers[j];
        if ((ans.sceneName == usr.sceneName && ans.indexNumber == usr.indexNumber)) { // must compare based on this.. there is no unique id
          // match found, compare data and combine
          combined[i] = combineKeys(ans, usr);
          match = true;
          break;
        }
      }
      if (!match) { // There was no user data for this set
        combined[i] = combineKeys(ans, null); 
      }
    }
    return combined;
  };


  return module;
}