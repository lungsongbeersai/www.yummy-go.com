"use client";

import type { Language } from "@/lib/language";
import { landingVideos, pickText } from "../landing-data";
import { landingUi } from "../landing-ui";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

export function LandingTutorials({ language }: LandingSectionProps) {
  return (
    <section id="tutorials" className={`${styles.section} ${styles.band}`}>
      <div className={styles.bandInner}>
        <div data-reveal className={`${styles.reveal} ${styles.tutorialsHead}`}>
          <div className={styles.kicker}>▶</div>
          <h2 className={styles.tutorialsTitle}>{pickText(landingUi.tutorialsTitle, language)}</h2>
          <p className={styles.tutorialsSubtitle}>{pickText(landingUi.tutorialsSubtitle, language)}</p>
        </div>
        <div data-reveal className={`${styles.reveal} ${styles.videosGrid}`}>
          {landingVideos.map((video) => (
            <div key={video.id} data-tilt className={styles.videoCard}>
              <div data-glare className={styles.glare} />
              <div className={styles.videoThumb}>
                <div className={styles.playCircle}>
                  <div className={styles.playTriangle} />
                </div>
                <span className={styles.videoDuration}>{video.duration}</span>
                <span className={styles.videoCat}>{video.category}</span>
              </div>
              <div className={styles.videoBody}>
                <div className={styles.videoTitle}>{pickText(video.title, language)}</div>
                <div className={styles.videoDesc}>{pickText(video.description, language)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
