import { Component, signal, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-lottery-main',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  standalone: true,
})
export class App {
  protected readonly Math = Math; // Make Math available in template

  // App configuration
  appTitle = signal('Undian Berhadiah');
  appSubtitle = signal('Kelola peserta dan lakukan undian berhadiah!');

  // Local storage keys
  private readonly STORAGE_KEYS = {
    participants: 'undian_participants',
    winners: 'undian_winners',
    drawSessions: 'undian_draw_sessions',
    sessionCounter: 'undian_session_counter',
  };

  // State untuk undian
  participants = signal<string[]>([]);
  newParticipant = signal('');
  winners = signal<string[]>([]);
  currentWinner = signal<string | null>(null);
  latestWinners = signal<string[]>([]); // Pemenang dari undian terbaru
  drawSessions = signal<{ sessionId: number; winners: string[]; timestamp: Date }[]>([]); // Grouping berdasarkan sesi undian
  isDrawing = signal(false);
  stopRequested = signal(false); // Flag untuk menghentikan undian
  winnerCount = signal(1);
  sessionCounter = 0;
  showDrawSessions = signal(false); // Toggle untuk menampilkan riwayat undian
  hasCustomBackground = signal(false); // Track if custom background (image/GIF) is loaded
  backgroundImageUrl = signal<string>('');
  currentImageInfo = signal<{ name: string; size: number; type: string } | null>(null);
  showConfig = signal(false); // Toggle for configuration menu
  showParticipants = signal(false); // Toggle untuk menampilkan section peserta
  showHistory = signal(false); // Toggle untuk menampilkan section riwayat
  csvFileName = signal<string>(''); // Track uploaded CSV filename
  isFullscreen = signal(false); // Track fullscreen state
  showImageUploadCard = signal(false); // Toggle untuk menampilkan card upload image

  constructor(private router: Router) {
    // Load from localStorage only after component is rendered in browser
    afterNextRender(() => {
      this.loadFromLocalStorage();
      this.setupFullscreenListeners();
    });
  }

  private setupFullscreenListeners() {
    // Listen for fullscreen change events
    const fullscreenChangeHandler = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      );
      this.isFullscreen.set(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', fullscreenChangeHandler);
    document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
    document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
    document.addEventListener('msfullscreenchange', fullscreenChangeHandler);
  } // Computed property untuk peserta yang masih bisa diundi
  get availableParticipants() {
    return this.participants().filter((participant) => !this.winners().includes(participant));
  }

  // Computed property untuk mengurutkan riwayat undian berdasarkan session terbaru
  get sortedDrawSessions() {
    return this.drawSessions()
      .slice()
      .sort((a, b) => {
        // Sort by sessionId descending (newest first)
        return b.sessionId - a.sessionId;
      });
  }

  // Menambahkan peserta baru
  addParticipant() {
    const name = this.newParticipant().trim();
    if (name && !this.participants().includes(name)) {
      this.participants.update((current) => [...current, name]);
      this.newParticipant.set('');
      this.saveToLocalStorage();
    }
  }

  // Menghapus peserta
  removeParticipant(name: string) {
    this.participants.update((current) => current.filter((p) => p !== name));
    // Juga hapus dari winners jika ada
    this.winners.update((current) => current.filter((p) => p !== name));
    this.saveToLocalStorage();
  }

  // Melakukan undian
  drawWinner() {
    const availableParticipants = this.availableParticipants;
    const requestedCount = this.winnerCount();
    const maxPossible = Math.min(requestedCount, availableParticipants.length);

    if (availableParticipants.length === 0 || maxPossible === 0) return;

    this.isDrawing.set(true);
    this.stopRequested.set(false); // Reset stop flag
    this.latestWinners.set([]); // Reset pemenang terbaru

    // Set initial winner untuk memastikan ada winner sejak awal
    const initialWinner =
      availableParticipants[Math.floor(Math.random() * availableParticipants.length)];
    this.currentWinner.set(initialWinner);

    // Array untuk menyimpan pemenang yang akan ditambahkan
    const newWinners: string[] = [];
    let currentDrawIndex = 0;

    // Simulasi animasi undian
    let counter = 0;
    const maxCount = 20;

    const interval = setInterval(() => {
      // ONLY stop if user manually clicked stop button
      if (this.stopRequested()) {
        clearInterval(interval);
        this.isDrawing.set(false);
        this.stopRequested.set(false);

        // If no winners selected yet, select the requested number of winners
        if (newWinners.length === 0) {
          const remainingParticipants = availableParticipants.filter(
            (p) => !newWinners.includes(p)
          );
          const winnersToSelect = Math.min(maxPossible, remainingParticipants.length);

          // Select multiple winners randomly when stopped
          const selectedWinners = [...remainingParticipants]
            .sort(() => Math.random() - 0.5)
            .slice(0, winnersToSelect);

          newWinners.push(...selectedWinners);

          // Update current winner display to show first selected winner
          if (selectedWinners.length > 0) {
            this.currentWinner.set(selectedWinners[0]);
          }
        }

        // Save winners if any were selected (either during animation or current winner)
        if (newWinners.length > 0) {
          this.latestWinners.set([...newWinners]);
          this.winners.update((current) => [...current, ...newWinners]);

          // Simpan sesi undian
          this.sessionCounter++;
          this.drawSessions.update((current) => [
            ...current,
            {
              sessionId: this.sessionCounter,
              winners: [...newWinners],
              timestamp: new Date(),
            },
          ]);
          this.saveToLocalStorage();
          console.log('Manual stop - Winners saved:', newWinners);
          console.log('isDrawing after save:', this.isDrawing());
          console.log('latestWinners after save:', this.latestWinners());
        } else {
          console.log('Manual stop - No winners to save');
        }
        return; // Exit early - manual stop only
      }

      // Continue drawing animation - REMOVE ALL AUTO STOPS
      const remainingParticipants = availableParticipants.filter((p) => !newWinners.includes(p));

      // Keep cycling through available participants - no auto stop
      if (remainingParticipants.length > 0) {
        const randomIndex = Math.floor(Math.random() * remainingParticipants.length);
        this.currentWinner.set(remainingParticipants[randomIndex]);
        counter++;

        // Reset counter after animation cycles (no auto selection)
        if (counter >= maxCount) {
          counter = 0;
        }
      } else if (newWinners.length === 0) {
        // Only cycle through all participants if no winners selected yet
        const randomIndex = Math.floor(Math.random() * availableParticipants.length);
        this.currentWinner.set(availableParticipants[randomIndex]);
      }
    }, 100);
  }

  // Reset undian (hapus semua pemenang)
  resetDraw() {
    this.winners.set([]);
    this.currentWinner.set(null);
    this.latestWinners.set([]);
    this.drawSessions.set([]);
    this.sessionCounter = 0;
    this.showDrawSessions.set(false);
    this.isDrawing.set(false);
    this.stopRequested.set(false);
    this.saveToLocalStorage();
  }

  // Clear semua peserta dan pemenang
  clearAllParticipants() {
    this.participants.set([]);
    this.winners.set([]);
    this.currentWinner.set(null);
    this.latestWinners.set([]);
    this.drawSessions.set([]);
    this.sessionCounter = 0;
    this.showDrawSessions.set(false);
    this.isDrawing.set(false);
    this.stopRequested.set(false);
    this.clearLocalStorage();
  }

  // Clear hanya riwayat undian
  clearAllHistory() {
    this.winners.set([]);
    this.currentWinner.set(null);
    this.latestWinners.set([]);
    this.drawSessions.set([]);
    this.sessionCounter = 0;
    this.showDrawSessions.set(false);
    this.saveToLocalStorage();
    console.log('All history cleared');
  }

  // Hapus pemenang tertentu dari daftar winners
  removeWinner(name: string) {
    this.winners.update((current) => current.filter((p) => p !== name));
    this.saveToLocalStorage();
  }

  // Update jumlah pemenang yang diinginkan
  updateWinnerCount(count: number) {
    this.winnerCount.set(Math.max(1, count));
  }

  // Menghentikan undian yang sedang berlangsung - MANUAL ONLY
  stopDrawing() {
    // Only allow manual stop when drawing is actually active
    if (this.isDrawing() && !this.stopRequested()) {
      console.log('Manual stop requested by user');
      console.log('Current winner:', this.currentWinner());
      console.log('isDrawing before stop:', this.isDrawing());
      console.log('latestWinners before stop:', this.latestWinners());
      this.stopRequested.set(true);
    }
  }

  // Navigation methods for single page
  showParticipantsSection() {
    this.showParticipants.set(true);
    this.showHistory.set(false);
    this.showConfig.set(false);
    console.log('Showing participants section');
  }

  showHistorySection() {
    this.showParticipants.set(false);
    this.showHistory.set(true);
    this.showConfig.set(false);
    console.log('Showing history section');
  }

  showMainSection() {
    this.showParticipants.set(false);
    this.showHistory.set(false);
    this.showConfig.set(false);
    console.log('Showing main lottery section');
  }

  showConfigSection() {
    this.showParticipants.set(false);
    this.showHistory.set(false);
    this.showConfig.set(true);
    console.log('Showing configuration section');
  }

  // Local Storage Methods
  private loadFromLocalStorage() {
    // Check if we're in browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      // Load participants
      const savedParticipants = localStorage.getItem(this.STORAGE_KEYS.participants);
      if (savedParticipants) {
        this.participants.set(JSON.parse(savedParticipants));
      }

      // Load winners
      const savedWinners = localStorage.getItem(this.STORAGE_KEYS.winners);
      if (savedWinners) {
        this.winners.set(JSON.parse(savedWinners));
      }

      // Load draw sessions
      const savedDrawSessions = localStorage.getItem(this.STORAGE_KEYS.drawSessions);
      if (savedDrawSessions) {
        const sessions = JSON.parse(savedDrawSessions);
        // Convert timestamp strings back to Date objects
        const sessionsWithDates = sessions.map((session: any) => ({
          ...session,
          timestamp: new Date(session.timestamp),
        }));
        this.drawSessions.set(sessionsWithDates);
      }

      // Load session counter
      const savedSessionCounter = localStorage.getItem(this.STORAGE_KEYS.sessionCounter);
      if (savedSessionCounter) {
        this.sessionCounter = parseInt(savedSessionCounter, 10);
      }
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
    }
  }

  private saveToLocalStorage() {
    // Check if we're in browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.STORAGE_KEYS.participants, JSON.stringify(this.participants()));
      localStorage.setItem(this.STORAGE_KEYS.winners, JSON.stringify(this.winners()));
      localStorage.setItem(this.STORAGE_KEYS.drawSessions, JSON.stringify(this.drawSessions()));
      localStorage.setItem(this.STORAGE_KEYS.sessionCounter, this.sessionCounter.toString());
    } catch (error) {
      console.error('Error saving data to localStorage:', error);
    }
  }

  private clearLocalStorage() {
    // Check if we're in browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem(this.STORAGE_KEYS.participants);
      localStorage.removeItem(this.STORAGE_KEYS.winners);
      localStorage.removeItem(this.STORAGE_KEYS.drawSessions);
      localStorage.removeItem(this.STORAGE_KEYS.sessionCounter);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }

  // Custom background methods (images/GIF)
  onImageLoaded() {
    console.log('Background image loaded successfully!');
    this.hasCustomBackground.set(true);
  }

  onImageError() {
    console.log('Background image failed to load, using gradient background');
    this.hasCustomBackground.set(false);
  }

  checkCustomBackground() {
    const img = new Image();
    img.onload = () => {
      console.log('Background image loaded successfully');
      console.log('Image dimensions:', img.width + 'x' + img.height);
      console.log('Screen dimensions:', window.innerWidth + 'x' + window.innerHeight);

      // Automatically adjust positioning if needed
      this.optimizeImageCentering(img.width, img.height);

      this.hasCustomBackground.set(true);
    };
    img.onerror = () => {
      console.log('Background image failed to load, using gradient background');
      this.hasCustomBackground.set(false);
    };
    img.src = this.backgroundImageUrl();
  }

  // Automatically optimize image centering based on aspect ratios
  optimizeImageCentering(imageWidth: number, imageHeight: number) {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const imageRatio = imageWidth / imageHeight;
    const screenRatio = screenWidth / screenHeight;

    console.log('Auto-optimizing image position...');

    // If image is much wider than screen, might need vertical centering
    if (imageRatio > screenRatio * 1.5) {
      console.log('Image is wide - using center positioning');
      this.setImagePosition('center');
    }
    // If image is much taller than screen, might need horizontal centering
    else if (imageRatio < screenRatio * 0.7) {
      console.log('Image is tall - using center positioning');
      this.setImagePosition('center');
    } else {
      console.log('Image proportions are good - using center positioning');
      this.setImagePosition('center');
    }
  }

  // Method to change image sizing mode (optional)
  setImageSizingMode(mode: 'cover' | 'contain' | 'stretch' | 'auto') {
    const imageElement = document.querySelector('.bg-image') as HTMLElement;
    if (imageElement) {
      // Remove existing sizing classes
      imageElement.classList.remove(
        'bg-image-cover',
        'bg-image-contain',
        'bg-image-stretch',
        'bg-image-auto'
      );

      // Add new sizing class
      imageElement.classList.add(`bg-image-${mode}`);

      console.log(`Background image sizing changed to: ${mode}`);
    }
  }

  // Method to change image overlay opacity (optional)
  setImageOverlay(opacity: 'none' | 'light' | 'medium' | 'dark') {
    const imageElement = document.querySelector('.bg-image') as HTMLElement;
    if (imageElement) {
      // Remove existing overlay classes
      imageElement.classList.remove(
        'bg-image-no-overlay',
        'bg-image-light-overlay',
        'bg-image-medium-overlay',
        'bg-image-dark-overlay'
      );

      // Add new overlay class
      if (opacity !== 'medium') {
        // medium is default, no class needed
        imageElement.classList.add(`bg-image-${opacity}-overlay`);
      }

      console.log(`Background image overlay changed to: ${opacity}`);
    }
  }

  // Method to change image position (optional)
  setImagePosition(
    position: 'center' | 'top-center' | 'bottom-center' | 'left-center' | 'right-center'
  ) {
    const imageElement = document.querySelector('.bg-image') as HTMLElement;
    if (imageElement) {
      // Remove existing position classes
      imageElement.classList.remove(
        'bg-image-center',
        'bg-image-top-center',
        'bg-image-bottom-center',
        'bg-image-left-center',
        'bg-image-right-center'
      );

      // Add new position class
      if (position !== 'center') {
        // center is default, no class needed
        imageElement.classList.add(`bg-image-${position}`);
      }

      console.log(`GIF position changed to: ${position}`);
    }
  }

  // Handle image file selection (GIF, JPG, PNG, WebP)
  onImageFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    console.log('File selected:', file);
    
    if (file) {
      console.log('File details:', {
        name: file.name,
        type: file.type,
        size: file.size
      });
    }

    // Check if file is a valid image type
    const validTypes = ['image/gif', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (file && validTypes.includes(file.type)) {
      // Store file info
      this.currentImageInfo.set({
        name: file.name,
        size: file.size,
        type: file.type,
      });

      // Create object URL for the file
      const objectUrl = URL.createObjectURL(file);
      this.backgroundImageUrl.set(objectUrl);

      console.log(
        'Background image selected:',
        file.name,
        `(${this.formatFileSize(file.size)}) - ${file.type}`
      );

      // Set hasCustomBackground to true first so .bg-image element is rendered
      this.hasCustomBackground.set(true);

      // Hide upload card after successful upload
      this.showImageUploadCard.set(false);

      // Use setTimeout to ensure DOM is updated before setting background image
      setTimeout(() => {
        // Update background image
        this.updateBackgroundImage(objectUrl);
        
        // Check if the image loads properly
        this.checkCustomBackground();
      }, 100);
    } else {
      alert('Silakan pilih file gambar yang valid (GIF, JPG, PNG, atau WebP).');
      input.value = ''; // Reset input
    }
  }

  // Remove current GIF background
  removeCustomBackground() {
    // Clear current image info
    this.currentImageInfo.set(null);

    // Reset to default background
    this.backgroundImageUrl.set('');
    this.hasCustomBackground.set(false);

    // Clear file input
    const input = document.getElementById('image-file-input') as HTMLInputElement;
    if (input) {
      input.value = '';
    }

    // Reset background to default gradient
    this.setDefaultBackground();

    console.log('Custom background removed, reverted to default gradient');
  }

  // Update background image dynamically
  updateBackgroundImage(imagePath: string) {
    // Try multiple times if element not found initially
    let attempts = 0;
    const maxAttempts = 5;
    
    const tryUpdate = () => {
      const imageElement = document.querySelector('.bg-image') as HTMLElement;
      console.log(`Attempt ${attempts + 1}: Looking for .bg-image element:`, imageElement);
      
      if (imageElement) {
        if (imagePath.startsWith('blob:')) {
          imageElement.style.backgroundImage = `url("${imagePath}")`;
        } else {
          imageElement.style.backgroundImage = `url("/${imagePath}")`;
        }
        imageElement.style.backgroundSize = 'cover';
        imageElement.style.backgroundPosition = 'top center';
        imageElement.style.backgroundRepeat = 'no-repeat';
        
        console.log(`Background image updated to: ${imagePath}`);
        console.log('Element background image style:', imageElement.style.backgroundImage);

        // Apply default settings for custom images
        this.setImageOverlay('medium');
        this.setImagePosition('top-center');
      } else {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`Element not found, retrying in 100ms... (attempt ${attempts}/${maxAttempts})`);
          setTimeout(tryUpdate, 100);
        } else {
          console.error('Could not find .bg-image element after maximum attempts');
        }
      }
    };
    
    tryUpdate();
  }

  // Format file size for display
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get user-friendly label for image type
  getImageTypeLabel(mimeType: string): string {
    const typeMap: { [key: string]: string } = {
      'image/gif': 'GIF (Animasi)',
      'image/jpeg': 'JPEG',
      'image/jpg': 'JPG',
      'image/png': 'PNG',
      'image/webp': 'WebP',
    };

    return typeMap[mimeType] || mimeType;
  }

  // Configuration methods
  updateAppTitle(title: string) {
    this.appTitle.set(title.trim() || 'Undian Berhadiah');
    console.log('App title updated:', this.appTitle());
  }

  updateAppSubtitle(subtitle: string) {
    this.appSubtitle.set(subtitle.trim() || 'Kelola peserta dan lakukan undian berhadiah!');
    console.log('App subtitle updated:', this.appSubtitle());
  }

  resetToDefaultTexts() {
    this.appTitle.set('Undian Berhadiah');
    this.appSubtitle.set('Kelola peserta dan lakukan undian berhadiah!');
    console.log('App texts reset to default');
  }

  // Background configuration methods (section-based navigation)
  // Method showConfigSection() already defined above in navigation section

  setDefaultBackground() {
    // Remove any uploaded custom background
    this.hasCustomBackground.set(false);
    this.backgroundImageUrl.set('');
    this.currentImageInfo.set(null);
    this.showImageUploadCard.set(false); // Hide upload card

    // Clear file input
    const input = document.getElementById('image-file-input') as HTMLInputElement;
    if (input) {
      input.value = '';
    }

    // Remove background image from element
    const imageElement = document.querySelector('.bg-image') as HTMLElement;
    if (imageElement) {
      imageElement.style.backgroundImage = '';
    }

    console.log('Set to default gradient background');
  }

  showImageUpload() {
    // Toggle the image upload interface
    this.showImageUploadCard.set(true);
    console.log('Image upload interface enabled');
  }

  // Fullscreen Methods
  enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem
        .requestFullscreen()
        .then(() => {
          this.isFullscreen.set(true);
          console.log('Entered fullscreen mode');
        })
        .catch((err) => {
          console.error('Failed to enter fullscreen:', err);
        });
    } else if ((elem as any).mozRequestFullScreen) {
      // Firefox
      (elem as any).mozRequestFullScreen();
      this.isFullscreen.set(true);
    } else if ((elem as any).webkitRequestFullscreen) {
      // Chrome, Safari and Opera
      (elem as any).webkitRequestFullscreen();
      this.isFullscreen.set(true);
    } else if ((elem as any).msRequestFullscreen) {
      // IE/Edge
      (elem as any).msRequestFullscreen();
      this.isFullscreen.set(true);
    }
  }

  exitFullscreen() {
    if (document.exitFullscreen) {
      document
        .exitFullscreen()
        .then(() => {
          this.isFullscreen.set(false);
          console.log('Exited fullscreen mode');
        })
        .catch((err) => {
          console.error('Failed to exit fullscreen:', err);
        });
    } else if ((document as any).mozCancelFullScreen) {
      // Firefox
      (document as any).mozCancelFullScreen();
      this.isFullscreen.set(false);
    } else if ((document as any).webkitExitFullscreen) {
      // Chrome, Safari and Opera
      (document as any).webkitExitFullscreen();
      this.isFullscreen.set(false);
    } else if ((document as any).msExitFullscreen) {
      // IE/Edge
      (document as any).msExitFullscreen();
      this.isFullscreen.set(false);
    }
  }

  toggleFullscreen() {
    if (this.isFullscreen()) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  // CSV Import/Export methods
  onCsvFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file && file.type === 'text/csv') {
      this.csvFileName.set(file.name);

      const reader = new FileReader();
      reader.onload = (e) => {
        const csvText = e.target?.result as string;
        this.parseCsvAndAddParticipants(csvText);
      };
      reader.readAsText(file);

      console.log('CSV file selected:', file.name);
    } else {
      alert('Silakan pilih file CSV yang valid.');
      input.value = '';
      this.csvFileName.set('');
    }
  }

  private parseCsvAndAddParticipants(csvText: string) {
    try {
      const lines = csvText.split('\n');
      const newParticipants: string[] = [];

      // Skip first line (header) and process from index 1
      lines.forEach((line, index) => {
        // Skip header row (index 0)
        if (index === 0) return;

        const trimmedLine = line.trim();
        if (trimmedLine) {
          // Handle comma-separated values - take first column if multiple columns
          const columns = trimmedLine.split(',');
          const name = columns[0].trim().replace(/"/g, ''); // Remove quotes

          if (name && !this.participants().includes(name) && !newParticipants.includes(name)) {
            newParticipants.push(name);
          }
        }
      });

      if (newParticipants.length > 0) {
        // Add new participants to existing list
        this.participants.update((current) => [...current, ...newParticipants]);
        this.saveToLocalStorage();

        alert(`✅ Berhasil menambahkan ${newParticipants.length} peserta dari CSV!`);
        console.log('Added participants from CSV:', newParticipants);
      } else {
        alert('⚠️ Tidak ada peserta baru yang dapat ditambahkan dari CSV.');
      }

      // Clear file input
      const input = document.getElementById('csv-file-input') as HTMLInputElement;
      if (input) {
        input.value = '';
      }
      this.csvFileName.set('');
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert('❌ Error parsing CSV file. Pastikan format file benar.');
    }
  }

  exportToCSV() {
    if (this.participants().length === 0) {
      alert('Tidak ada peserta untuk di-export.');
      return;
    }

    try {
      // Create CSV content
      const csvHeader = 'Nama Peserta\n';
      const csvRows = this.participants()
        .map((name) => `"${name}"`)
        .join('\n');
      const csvContent = csvHeader + csvRows;

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');

      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute(
          'download',
          `peserta-undian-${new Date().toISOString().split('T')[0]}.csv`
        );
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('CSV exported successfully');
        alert('✅ File CSV berhasil di-download!');
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('❌ Error saat export CSV.');
    }
  }

  downloadSampleCSV() {
    try {
      // Sample CSV content with Indonesian names
      const sampleData = [
        'Nama Peserta',
        'Ahmad Santoso',
        'Siti Nurhaliza',
        'Budi Prasetyo',
        'Dewi Sartika',
        'Eko Wijaya',
        'Fitri Rahmawati',
        'Gunawan Setiawan',
        'Heni Purwanti',
        'Indra Kurniawan',
        'Jasmin Maharani',
        'Kartika Sari',
        'Lukman Hakim',
        'Maya Sari',
        'Nanda Pratama',
        'Oktavia Damayanti',
      ];

      const csvContent = sampleData.map((name) => `"${name}"`).join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');

      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'sample-peserta-undian.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('Sample CSV downloaded successfully');
        alert('✅ Sample CSV berhasil di-download! Gunakan sebagai template.');
      }
    } catch (error) {
      console.error('Error downloading sample CSV:', error);
      alert('❌ Error saat download sample CSV.');
    }
  }
}
