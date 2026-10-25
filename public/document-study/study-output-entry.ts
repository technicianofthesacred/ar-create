import {mountStudyOutputHost} from './mountStudyOutputHost';
import {mountStudyAudience} from './mountStudyAudience';
import {mountMagazineAudience,prepareMagazineHtml,downloadMagazineHtml} from './mountMagazineAudience';
import '../../runtime/src/workspaces/workspace.css';
window.ArStudyOutputHost={mountStudyOutputHost,mountStudyAudience,mountMagazineAudience,prepareMagazineHtml,downloadMagazineHtml};
