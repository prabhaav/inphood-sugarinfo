const botBuilder = require('claudia-bot-builder');
const fbTemplate = botBuilder.fbTemplate;
const utils = require('./utils.js')
const sugarUtils = require('./sugarUtils.js')
const constants = require('./constants.js')

const requestPromise = require('request-promise')
const firebase = require('firebase')

function sugarResponse (userId, foodName, sugarPercentage) {
  const wvMsg = {
    uri: 'https://graph.facebook.com/v2.6/me/messages?access_token=' + process.env.FACEBOOK_BEARER_TOKEN,
    json: true,
    method: 'POST',
    body: {
      'recipient':{
        'id': userId
      },
      'message':{
        'attachment':{
          'type':'template',
          "payload":{
            "template_type":"generic",
            "elements":[
               {
                "title": "Last Journal Item",
                "image_url": "https://d1q0ddz2y0icfw.cloudfront.net/progressBars/" + sugarPercentage + ".png",
                "subtitle": foodName,
                "default_action": {
                  "url": "https://s3-us-west-1.amazonaws.com/www.inphood.com/webviews/FoodJournalEntry.html",
                  "type": "web_url",
                  "messenger_extensions": "true",
                  "webview_height_ratio": "compact",
                  "webview_share_button": "true",
                  "fallback_url": "https://www.inphood.com/"
                },
                "buttons":[
                  {
                    "type": "postback",
                    "title": "Delete From Journal",
                    "payload": "delete last item"
                  }
                ]
              }
            ]
          }
        }
      }
    },
    resolveWithFullResponse: true,
    headers: {
      'Content-Type': "application/json"
    }
  }
  return requestPromise(wvMsg)
}

function subSlashes( str ) { 
  if (str) {
    return str.replace(/[\/\.$#\[\]]/g, '_');
  }
  return ''
}

exports.addSugarToFirebase = function(userId, date, fulldate, barcode, data) {
  var userRef = firebase.database().ref("/global/sugarinfoai/" + userId)
  return userRef.once("value")
  .then(function(snapshot) {
    const {
      photo,
      sugar,
      carbs,
      fiber,
      psugar,
      nsugar,
      sugarArr,
      carbsArr,
      fiberArr,
      foodName,
      cleanText,
      sugarPerServingStr,
      carbsPerServingStr,
      fiberPerServingStr,
      ingredientsSugarsCaps
    } = data
    userRef.child("/sugarIntake/" + date).push({
      photo,
      sugar,
      carbs,
      fiber,
      psugar,
      nsugar,
      sugarArr,
      carbsArr,
      fiberArr,
      foodName,
      cleanText,
      sugarPerServingStr,
      carbsPerServingStr,
      fiberPerServingStr,
      ingredientsSugarsCaps,
      timestamp: fulldate,
    })
    const goalWeight = snapshot.child('/preferences/currentGoalWeight').val()
    let goalSugar = snapshot.child('/preferences/currentGoalSugar').val()
    let val = snapshot.child('/sugarIntake/' + date + '/dailyTotal/sugar').val()
    if (!val)
      val = 0
    if (!goalSugar)
      goalSugar = 36
    const newVal = parseInt(val) + parseInt(sugar)
    let cleanPath = subSlashes(cleanText)
    return userRef.child('/myfoods/' + cleanPath).update({ 
      photo,
      sugar,
      carbs,
      fiber,
      psugar,
      nsugar,
      sugarArr,
      carbsArr,
      fiberArr,
      foodName,
      cleanText,
      sugarPerServingStr,
      carbsPerServingStr,
      fiberPerServingStr,
      ingredientsSugarsCaps
    })
    .then(() => {
      return userRef.child('/myfoods/' +  cleanPath + '/date').push({ 
        timestamp: Date.now(),
      })
      .then(() => {
        return userRef.child('/sugarIntake/' + date + '/dailyTotal/').update({ sugar: newVal })
        .then(() => {
          const sugarPercentage = Math.ceil(psugar*100/goalSugar)
          return sugarResponse (userId, foodName, sugarPercentage)
          .then(() => {
            if (ingredientsSugarsCaps && sugar >= 3) {
              return [
                'Ingredients (sugars in caps): ' + ingredientsSugarsCaps,
                'Sugar Visualization: 🍪🍭🍩🍫',
                new fbTemplate
                .Image(sugarUtils.getGifUrl(sugar))
                .get(),
                constants.generateTip(constants.encouragingTips)
                // 'Okay—you just ate about ' + Math.ceil(sugar*100/goalSugar) + '% (' + sugar + 'g). I have updated your journal',
              ]
            }
            else if (Math.round(psugar) > 2) {
              return [
                'Sugar Visualization: 🍪🍭🍩🍫',
                new fbTemplate
                .Image(sugarUtils.getGifUrl(Math.round(psugar)))
                .get(),
                // 'Okay—you just ate about ' + Math.ceil(sugar*100/goalSugar) + '% (' + sugar + 'g). I have updated your journal',
                constants.generateTip(constants.encouragingTips)
              ]
            }
            else if (ingredientsSugarsCaps && sugar > 0) {
              return [
                'Ingredients (sugars in caps): ' + ingredientsSugarsCaps,
                sugar + 'g of sugar found',
                // 'Okay—you just ate about ' + Math.ceil(sugar*100/goalSugar) + '% (' + sugar + 'g). I have updated your journal',
              ]
            }
            else if (Math.round(psugar) > 0) {
              return [
                // 'Okay—you just ate about ' + Math.ceil(sugar*100/goalSugar) + '% (' + sugar + 'g). I have updated your journal',
                constants.generateTip(constants.encouragingTips)
              ]
            }
            else if (sugar === 0) {
              return [
                'Congratulations! 🎉🎉 No sugars found!',
                constants.generateTip(constants.encouragingTips)
              ]
            }
          })
        })
      })
    })
  })
  .catch((error) => {
    console.log('Error', error)
  })
}

exports.findMyFavorites = function(favoriteMeal, userId, date, fulldate) {
  let objRef = firebase.database().ref('/global/sugarinfoai/' + userId + '/myfoods/' + favoriteMeal + '/')
  return objRef.once("value")
  .then(function(snapshot) {
    let sugarPerServing = snapshot.child('sugar').val()
    let sugarPerServingStr = snapshot.child('sugarPerServingStr').val()
    let ingredientsSugarsCaps = snapshot.child('ingredientsSugarsCaps').val()
    console.log('results', sugarPerServing, sugarPerServingStr, ingredientsSugarsCaps)
    return firebase.database().ref('/global/sugarinfoai/' + userId + '/temp/data/favorites').remove()
    .then(() => {
      var tempRef = firebase.database().ref("/global/sugarinfoai/" + userId + "/temp/data/")
      let sugar = parseInt(sugarPerServing)
      if (!ingredientsSugarsCaps)
        ingredientsSugarsCaps = ''
      return tempRef.child('food').set({
        sugar: sugarPerServing,
        foodName: favoriteMeal,
        sugarPerServingStr,
        cleanText: favoriteMeal,
        ingredientsSugarsCaps
      })
      .then(() => {
        return exports.addSugarToFirebase(userId, date, fulldate)
      })
    })
  })
  .catch(error => {
    console.log('Errors', error)
  })
}

exports.trackUserProfile = function(userId) {
  var fbOptions = {
    uri: 'https://graph.facebook.com/v2.6/' + userId,
    method: 'GET',
    json: true,
    qs: {
      fields: 'first_name,last_name,profile_pic,locale,timezone,gender',
      access_token: 'EAAJhTtF5K30BAObDIIHWxtZA0EtwbVX6wEciIZAHwrwBJrXVXFZCy69Pn07SoyzZAeZCEmswE0jUzamY7Nfy71cZB8O7BSZBpTZAgbDxoYEE5Og7nbkoQvMaCafrBkH151s4wl91zOCLbafkdJiWLIc6deW9jSZBYdjh2NE4JbDSZBAwZDZD'
    },
    resolveWithFullResponse: true
  }
  const request = require('request-promise')
  return request(fbOptions)
  .then(result => {
    console.log('User Data Fetched', result)
    const data = result.body
    // console.log('Data', data)
    const {first_name, last_name, profile_pic, locale, timezone, gender} = data
    var userRef = firebase.database().ref("/global/sugarinfoai/" + userId + "/profile")
    return userRef.update({
      first_name,
      last_name,
      profile_pic,
      locale,
      timezone,
      gender,
      userId,
      // is_payment_enabled
    })
  })
  .catch(error => {
    console.log('Something went wrong', error)
  })
}