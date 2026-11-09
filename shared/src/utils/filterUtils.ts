import { FilterActions } from '../types/types';

const actionsWithReplacement: readonly FilterActions[] = [
  FilterActions.REPLACE_WORD,
  FilterActions.REPLACE_LINE,
  FilterActions.REGEX_REPLACE,
  FilterActions.PREPEND_TEXT,
  FilterActions.APPEND_TEXT,
];

export function requiresFilterReplacement(action?: FilterActions): boolean {
  return action !== undefined && actionsWithReplacement.includes(action);
}

export function usesFilterPattern(action: FilterActions): boolean {
  return action !== FilterActions.PREPEND_TEXT && action !== FilterActions.APPEND_TEXT;
}
