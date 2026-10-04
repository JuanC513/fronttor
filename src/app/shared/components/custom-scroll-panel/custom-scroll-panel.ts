import { Component, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ScrollPanel, ScrollPanelModule } from 'primeng/scrollpanel';

@Component({
  selector: 'app-custom-scroll-panel',
  imports: [ScrollPanelModule, ButtonModule],
  templateUrl: './custom-scroll-panel.html',
  styleUrl: './custom-scroll-panel.scss',
})
export class CustomScrollPanel implements AfterViewInit, OnDestroy {
  @ViewChild('myScroll') myScroll!: ScrollPanel;

  showScrollTop = false;
  private scrollContent?: HTMLElement;

  private onScroll = () => {
    // aparece después de 300px
    this.showScrollTop = this.scrollContent!.scrollTop > 300;
  };

  ngAfterViewInit() {
    this.scrollContent = this.myScroll.el.nativeElement.querySelector('.p-scrollpanel-content');
    this.scrollContent?.addEventListener('scroll', this.onScroll);
  }

  ngOnDestroy() {
    this.scrollContent?.removeEventListener('scroll', this.onScroll);
  }

  scrollToTop() {
    this.scrollContent?.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
