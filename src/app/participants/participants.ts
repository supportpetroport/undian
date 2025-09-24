import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-participants',
  imports: [CommonModule, FormsModule],
  templateUrl: './participants.html',
  styleUrl: './participants.scss',
  standalone: true,
})
export class ParticipantsComponent {
  participants = signal<string[]>([]);
  newParticipant = signal('');
  googleSheetsUrl = signal(
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQrR1M9ywaO56V6TTq2NAFKln6GOgOaBe4Q9mh8B01HWze2CMQIVUjQy47G4_xqRPFOl-OWfXqWSDEw/pub?gid=0&single=true&output=csv'
  );
  isImporting = signal(false);
  importMessage = signal<string | null>(null);

  private readonly STORAGE_KEYS = {
    participants: 'undian_participants',
  };

  constructor(private router: Router, private http: HttpClient) {
    this.loadParticipants();
  }

  // Load participants from localStorage
  private loadParticipants() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const savedParticipants = localStorage.getItem(this.STORAGE_KEYS.participants);
      if (savedParticipants) {
        this.participants.set(JSON.parse(savedParticipants));
      }
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  }

  // Save participants to localStorage
  private saveParticipants() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.STORAGE_KEYS.participants, JSON.stringify(this.participants()));
    } catch (error) {
      console.error('Error saving participants:', error);
    }
  }

  // Add new participant
  addParticipant() {
    const name = this.newParticipant().trim();
    if (name && !this.participants().includes(name)) {
      this.participants.update((current) => [...current, name]);
      this.newParticipant.set('');
      this.saveParticipants();
    }
  }

  // Remove participant
  removeParticipant(name: string) {
    this.participants.update((current) => current.filter((p) => p !== name));
    this.saveParticipants();
  }

  // Clear all participants
  clearAllParticipants() {
    this.participants.set([]);
    this.saveParticipants();
  }

  // Import participants from Google Sheets
  importFromGoogleSheets() {
    const url = this.googleSheetsUrl().trim();
    if (!url) {
      this.importMessage.set('❌ URL Google Sheets tidak boleh kosong');
      return;
    }

    this.isImporting.set(true);
    this.importMessage.set(null);

    this.http.get(url, { responseType: 'text' }).subscribe({
      next: (csvData) => {
        try {
          const participants = this.parseCsvData(csvData);
          if (participants.length > 0) {
            // Merge with existing participants (avoid duplicates)
            const currentParticipants = this.participants();
            const newParticipants = participants.filter((p) => !currentParticipants.includes(p));

            if (newParticipants.length > 0) {
              this.participants.update((current) => [...current, ...newParticipants]);
              this.saveParticipants();
              this.importMessage.set(`✅ Berhasil import ${newParticipants.length} peserta baru`);
            } else {
              this.importMessage.set('ℹ️ Tidak ada peserta baru untuk diimport');
            }
          } else {
            this.importMessage.set('❌ Tidak ada data peserta yang valid ditemukan');
          }
        } catch (error) {
          console.error('Error parsing CSV:', error);
          this.importMessage.set('❌ Error saat memproses data CSV');
        } finally {
          this.isImporting.set(false);
        }
      },
      error: (error) => {
        console.error('Error importing from Google Sheets:', error);
        this.importMessage.set('❌ Error saat mengambil data dari Google Sheets');
        this.isImporting.set(false);
      },
    });
  }

  // Parse CSV data and extract participant names
  private parseCsvData(csvData: string): string[] {
    const participants: string[] = [];
    const lines = csvData.split('\n');

    for (let i = 1; i < lines.length; i++) {
      // Start from row 2 (index 1)
      const line = lines[i].trim();
      if (line) {
        // Split by comma and take the second column (index 1)
        const columns = line.split(',').map((col) => col.replace(/"/g, '').trim());
        const name = columns[1]; // Column 2 (index 1)

        // Add valid participant names
        if (name && name.length > 0 && !participants.includes(name)) {
          participants.push(name);
        }
      }
    }

    return participants;
  }

  // Replace all participants with data from Google Sheets
  replaceWithGoogleSheets() {
    const url = this.googleSheetsUrl().trim();
    if (!url) {
      this.importMessage.set('❌ URL Google Sheets tidak boleh kosong');
      return;
    }

    this.isImporting.set(true);
    this.importMessage.set(null);

    this.http.get(url, { responseType: 'text' }).subscribe({
      next: (csvData) => {
        try {
          const participants = this.parseCsvData(csvData);
          if (participants.length > 0) {
            this.participants.set(participants);
            this.saveParticipants();
            this.importMessage.set(
              `✅ Berhasil replace dengan ${participants.length} peserta dari Google Sheets`
            );
          } else {
            this.importMessage.set('❌ Tidak ada data peserta yang valid ditemukan');
          }
        } catch (error) {
          console.error('Error parsing CSV:', error);
          this.importMessage.set('❌ Error saat memproses data CSV');
        } finally {
          this.isImporting.set(false);
        }
      },
      error: (error) => {
        console.error('Error importing from Google Sheets:', error);
        this.importMessage.set('❌ Error saat mengambil data dari Google Sheets');
        this.isImporting.set(false);
      },
    });
  }

  // Navigate back to main lottery page
  backToLottery() {
    this.router.navigate(['/']);
  }
}
