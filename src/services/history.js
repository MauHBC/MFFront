import { createBrowserHistory } from "history";
import { getClinicalRecordUserConfirmation } from "./clinicalRecordNavigationConfirmation";

const history = createBrowserHistory({ getUserConfirmation: getClinicalRecordUserConfirmation });

export default history;
