// z/OS Dataset Name Validation Test Cases
// Copy and paste these into the browser console when testing the webview

/*
// Valid dataset names - should pass validation
"HLQ.DATASET"
"USER.DEV.DATA" 
"SYS1.PARMLIB"
"TEST.PDS(MEMBER)"
"DEV.SOURCE(COBOL01)"
"#TEST.DATA"
"$USER.WORK"
"@PROD.FILES"
*/

// Valid dataset names
const validTests = [
  'HLQ.DATASET',
  'USER.DEV.DATA',
  'SYS1.PARMLIB',
  'TEST.PDS(MEMBER)',
  'DEV.SOURCE(COBOL01)',
  '#TEST.DATA',
  '$USER.WORK',
  '@PROD.FILES'
];

// Invalid dataset names  
const invalidTests = [
  'TOOLONG.DATASET.NAME.THAT.EXCEEDS.FORTY.FOUR.CHARACTERS.LIMIT',
  'ONLYONE',
  'HLQ..DATASET',
  'HLQ.DATASET.',
  'HLQ.TOOLONGSEGMENT',
  'HLQ.9STARTS',
  'HLQ.INVALID@CHAR',
  'TEST.PDS(TOOLONGMEMBER)',
  'TEST.PDS(9MEMBER)',
  ''
];

console.log('\nValid dataset names:');
validTests.forEach(test => {
  const result = validateCommAreaName(test);
  console.log(`"${test}": ${result.isValid ? '✓ VALID' : '✗ INVALID - ' + result.error}`);
});

console.log('\nInvalid dataset names:');
invalidTests.forEach(test => {
  const result = validateCommAreaName(test);
  console.log(`"${test}": ${result.isValid ? '✓ VALID' : '✗ INVALID - ' + result.error}`);
});