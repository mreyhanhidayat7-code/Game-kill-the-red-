/**
 * Google Apps Script backend for Kill the Red.
 * 1) Create a Google Sheet.
 * 2) Extensions -> Apps Script.
 * 3) Paste this code.
 * 4) Change SHEET_NAME if needed.
 * 5) Deploy -> New deployment -> Web app -> Execute as Me -> Anyone.
 * 6) Copy the /exec URL into game.js CONFIG.SHEETS_URL.
 */
const SHEET_NAME = "Leaderboard";

function setup(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if(!sh) sh = ss.insertSheet(SHEET_NAME);
  if(sh.getLastRow()===0) sh.appendRow(["username","score","level","kills","date"]);
}

function doGet(){
  setup();
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const values=sh.getDataRange().getValues();
  if(values.length<=1)return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
  const rows=values.slice(1).filter(r=>r[0]).map(r=>({username:r[0],score:Number(r[1])||0,level:Number(r[2])||1,kills:Number(r[3])||0,date:r[4]}));
  rows.sort((a,b)=>b.score-a.score);
  return ContentService.createTextOutput(JSON.stringify(rows.slice(0,50))).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  setup();
  let data={};
  try{data=JSON.parse(e.postData.contents||"{}")}catch(err){}
  const username=String(data.username||"Player").trim().slice(0,16);
  const score=Math.max(0,Number(data.score)||0);
  const level=Math.max(1,Number(data.level)||1);
  const kills=Math.max(0,Number(data.kills)||0);
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  sh.appendRow([username,score,level,kills,new Date()]);
  return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
                      }
