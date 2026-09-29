import { localIsoDate, puzzleNumber } from "../shared/day";

const issue = document.getElementById("issue");
if (issue) {
  const today = localIsoDate();
  const number = puzzleNumber(today);
  const longDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  issue.textContent = number === null ? longDate : `No. ${number} \u00b7 ${longDate}`;
}
