import type { ValidationIssue } from '../types/rack';

export const isThermalIssue = (issue: Pick<ValidationIssue, 'id' | 'title'>) =>
  /heat|airflow|thermal/i.test(`${issue.id} ${issue.title}`);
