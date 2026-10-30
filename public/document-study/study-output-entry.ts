import {mountStudyOutputHost} from './mountStudyOutputHost';
import {mountStudyAudience} from './mountStudyAudience';
import {mountMagazineAudience,prepareMagazineHtml,downloadMagazineHtml} from './mountMagazineAudience';
import {approvalMarks} from '../../runtime/src/workspaces/editorial-state.mjs';
import '../../runtime/src/workspaces/workspace.css';
window.ArStudyOutputHost={mountStudyOutputHost,mountStudyAudience,mountMagazineAudience,prepareMagazineHtml,downloadMagazineHtml,approvalMarks};
