//
// Globals:
//
////////////////////////////////////////////////////////////////////////////////

var tz = undefined;
var spinner;

//
// Action handlers:
//
// Notes: action handlers recieve an id which can be one of:
//        'all' or '0' --> 'n' (n EI > 0)
////////////////////////////////////////////////////////////////////////////////

function handleOnInput(id) {
  logIt('handleOnInput id=' + id)
  logIt('----------------------------------------');


  let ele = document.getElementById(id);
  let value = ele.value;

  if (psid === null || value === null) {
    logIt('Error psid is unavailable or element value is null');
    return
  }

  let preferencesRef = firebase.database().ref('global/sugarinfoai/' + psid + '/preferences')
  let idPreferencesRef = preferencesRef.child(id)
  idPreferencesRef.set(value)

  if (id === 'currentWeight' && tz) {
    let userDateStr = getUserDateString(Date.now(), tz);
    let weightDatePreferencesIdRef = preferencesRef.child(userDateStr + '/weight')
    weightDatePreferencesIdRef.set(value)
  }
}

function handleSwitchChange(id) {
  logIt('handleSwitchChange id=' + id)
  logIt('----------------------------------------');

  let ele = document.getElementById(id);
  let value = ele.checked;
  
  if (psid === null || value === null) {
    logIt('Error psid is unavailable or element value is null');
    return
  }

  let preferencesIdRef = firebase.database().ref('global/sugarinfoai/' + psid + '/preferences/' + id);
  preferencesIdRef.set(value)
  logIt('  set firebase value to = ' + value);
  logIt('')
}

//
// Small HTML templates:
//
////////////////////////////////////////////////////////////////////////////////

function getEditableField(id, description, initialValue, min=0, max=100) {
  let html = ' \
    <div class="form-group"> \
      <div class="row""> \
        <div class="col-xs-5" style="padding-right:5px"> \
          <input id="' + id + '"  \
                 class="form-control text-right" \
                 style="font-size:16px" \
                 type="number" \
                 value="' + initialValue + '" \
                 oninput="handleOnInput(\'' + id + '\')" \
                 min="' + min + '" \
                 max="' + max + '"/> \
        </div> \
        <div class="col-xs-7" style="padding-left:5px"> \
          <label class="control-label" style="font-size:16px">' + description + '</label> \
        </div> \
      </div> \
    </div>';

  return html
}

function getSwitch(id, description, initialValue) {
  let state=''
  if (initialValue) {
    state='checked'
  }

  let html = ' \
    <div class="form-group"> \
      <div class="row"> \
        <div class="col-xs-5 text-right"> \
          <input id="' + id + '" \
                 type="checkbox" \
                 ' + state + ' \
                 onchange="handleSwitchChange(\'' + id + '\')"/> \
        </div> \
        <div class="col-xs-7" style="font-size:16px"> \
          <label class="control-label">' + description + '</label> \
        </div> \
      </div> \
    </div>';

  return html
}

//
// Large HTML templates:
//
////////////////////////////////////////////////////////////////////////////////

function getMainForm(sugarLimit=36, goalWeight=150, currentWeight=150, nightlySummary=true) {
  const goalSugarHtml = getEditableField('currentGoalSugar', 'Daily Sugar* (grams)', sugarLimit)
  const goalWeightHtml = getEditableField('currentGoalWeight', 'Body Weight (pounds)', goalWeight, 30, 700);
  const currentWeightHtml = getEditableField('currentWeight', 'Current Body Weight (pounds)', currentWeight, 30, 700);
  const nightlySummaryHtml = getSwitch('nightlySummary', 'Nightly Journal', nightlySummary);

  const formHtml = ' \
    <form> \
      <fieldset> \
        <div style="height:20px"></div> \
        <h4>Goals</h4> \
        <div style="border: 1px solid #000000; border-radius: 10px; padding: 10px 10px 0px"> \
          ' + goalSugarHtml + ' \
          ' + goalWeightHtml + ' \
        </div> \
        <p style="padding:5px"> \
          * The \
          <a href="http://www.heart.org/HEARTORG/HealthyLiving/HealthyEating/Nutrition/Added-Sugars_UCM_305858_Article.jsp"> \
            American Heart Association \
          </a> \
          recommends limiting added sugars consumed daily to 25 grams for most women and 36 grams for most men.\
        </p> \
        <div style="height:20px"></div> \
        <h4>My Data</h4> \
        <div style="border: 1px solid #000000; border-radius: 10px; padding: 10px 10px 0px"> \
          ' + currentWeightHtml + ' \
        </div> \
        <div style="height:20px"></div> \
        <h4>Notifications</h4> \
        <div style="border: 1px solid #000000; border-radius: 10px; padding: 10px"> \
          ' + nightlySummaryHtml + ' \
        </div> \
      </fieldset> \
    </form>';

  return formHtml;
}

//
// Initialization code:
//
////////////////////////////////////////////////////////////////////////////////

function initPageValuesFromDb(userRef) {
  logIt('initPageValuesFromDb');
  logIt('-------------------------------');
  
  const target = document.getElementById('mySettings');

  spinner = new Spinner().spin(target);
  logIt('spinner on');
 
  // Get the user's timezone.
  let profileTzRef = firebase.database().ref('global/sugarinfoai/' + psid + '/profile/timezone');
  profileTzRef.once('value', function(snapshot) {
    tz = snapshot.val();
  });

  // Get the user's settings data and initialize and install the form
  // into the settings page with it.
  let preferencesRef = userRef.child('preferences');
  preferencesRef.once('value', function(snapshot) {
    let preferences = snapshot.val();

    spinner.stop();
    logIt('spinner off');

    // Replace the empty html with our form that has proper
    // initial values from firebase.
    document.getElementById('mySettings').innerHTML=
      getMainForm(preferences.currentGoalSugar, 
                  preferences.currentGoalWeight,
                  preferences.currentWeight,
                  preferences.nightlySummary)

    // Now that the html is installed, style the switch.
    $("#nightlySummary").bootstrapSwitch({
      size: 'md'
    });
  });
}
