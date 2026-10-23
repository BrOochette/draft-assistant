import { assembleSampleSnapshot } from '@draft/schemas';
import banSuggestions from '../../../data/sample/ban-suggestions.json';
import candidates from '../../../data/sample/candidates.json';
import champions from '../../../data/sample/champions.json';
import matchupNotes from '../../../data/sample/matchup-notes.json';
import { appDataFrom } from '../src/data';

export const sampleAppData = () => appDataFrom(assembleSampleSnapshot({ champions, candidates, matchupNotes, banSuggestions }));
