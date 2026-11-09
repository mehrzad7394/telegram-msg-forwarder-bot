import { FilterActions } from '@repo/shared';

export const filterActions = {
  [FilterActions.REMOVE_WORD]: 'removeWord',
  [FilterActions.REPLACE_WORD]: 'replaceWord',
  [FilterActions.REMOVE_LINE]: 'removeLine',
  [FilterActions.REPLACE_LINE]: 'replaceLine',
  [FilterActions.REGEX_REPLACE]: 'regexReplace',
  [FilterActions.PREPEND_TEXT]: 'prependText',
  [FilterActions.APPEND_TEXT]: 'appendText',
} as const satisfies Record<FilterActions, string>;
