export const IMPORT_COLUMNS = [
  ["Candidate Name", "candidateName"],
  ["Referred Email ID", "referredEmail"],
  ["Original Email ID", "originalEmails"],
  ["Mobile No", "mobileNumbers"],
  ["Experience", "experience"],
  ["Skillset", "skillset"],
  ["Referred Date", "referredDate"],
  ["Status", "statusCode"],
  ["Referred To", "referredTo"],
  ["Current Location", "currentLocation"],
  ["Preferred Location", "preferredLocation"],
  ["Notice Period (Days)", "noticePeriod"],
  ["DOB", "dob"],
  ["Remarks", "remarks"],
  ["Job Code", "jobCodes"],
  ["PoC", "poc"],
  ["LinkedIn", "linkedin"],
] as const;
export const MAX_IMPORT_BYTES = 3 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 200;
