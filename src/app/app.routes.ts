import { Routes } from '@angular/router';
import { App } from './app';
import { ParticipantsComponent } from './participants/participants';
import { HistoryComponent } from './history/history';

export const routes: Routes = [
  { path: '', component: App },
  { path: 'participants', component: ParticipantsComponent },
  { path: 'history', component: HistoryComponent },
  { path: '**', redirectTo: '' },
];
