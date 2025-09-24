import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface DrawSession {
  sessionId: number;
  winners: string[];
  timestamp: Date;
}

@Component({
  selector: 'app-history',
  imports: [CommonModule],
  templateUrl: './history.html',
  styleUrl: './history.scss',
  standalone: true,
})
export class HistoryComponent {
  drawSessions = signal<DrawSession[]>([]);
  winners = signal<string[]>([]);

  private readonly STORAGE_KEYS = {
    winners: 'undian_winners',
    drawSessions: 'undian_draw_sessions',
  };

  constructor(private router: Router) {
    this.loadHistory();
  }

  // Computed property untuk mengurutkan riwayat undian berdasarkan session terbaru
  get sortedDrawSessions() {
    return this.drawSessions()
      .slice()
      .sort((a, b) => {
        return b.sessionId - a.sessionId;
      });
  }

  // Load history from localStorage
  private loadHistory() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      // Load winners
      const savedWinners = localStorage.getItem(this.STORAGE_KEYS.winners);
      if (savedWinners) {
        this.winners.set(JSON.parse(savedWinners));
      }

      // Load draw sessions
      const savedDrawSessions = localStorage.getItem(this.STORAGE_KEYS.drawSessions);
      if (savedDrawSessions) {
        const sessions = JSON.parse(savedDrawSessions);
        const sessionsWithDates = sessions.map((session: any) => ({
          ...session,
          timestamp: new Date(session.timestamp),
        }));
        this.drawSessions.set(sessionsWithDates);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }

  // Clear all history
  clearHistory() {
    if (confirm('Apakah Anda yakin ingin menghapus semua riwayat undian?')) {
      this.drawSessions.set([]);
      this.winners.set([]);
      this.saveHistory();
    }
  }

  // Save history to localStorage
  private saveHistory() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.STORAGE_KEYS.winners, JSON.stringify(this.winners()));
      localStorage.setItem(this.STORAGE_KEYS.drawSessions, JSON.stringify(this.drawSessions()));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  }

  // Navigate back to main lottery page
  backToLottery() {
    this.router.navigate(['/']);
  }

  // Format date for display
  formatDate(date: Date): string {
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
