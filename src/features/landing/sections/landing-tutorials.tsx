"use client";

import type { ReactNode } from "react";
import type { Language } from "@/lib/language";
import { landingVideos, pickText } from "../landing-data";
import { landingUi } from "../landing-ui";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

export function LandingTutorials({ language }: LandingSectionProps) {
  const text = (key: keyof typeof landingUi) => pickText(landingUi[key], language);

  if (!landingVideos.length) return null;

  return (
    <section id="tutorials" className={`${styles.section} ${styles.band}`}>
      <div className={styles.bandInner}>
        <div data-reveal className={`${styles.reveal} ${styles.tutorialsHead}`}>
          <div className={styles.kicker}>{text("tutorialsKicker")}</div>
          <h2 className={styles.tutorialsTitle}>{text("tutorialsTitle")}</h2>
          <p className={styles.tutorialsSubtitle}>{text("tutorialsSubtitle")}</p>
        </div>
        <div data-reveal className={`${styles.reveal} ${styles.videosGrid}`}>
          {landingVideos.map((video) => {
            const url = video.url.trim();

            // ยังไม่มีลิงก์ = ไม่ทำเป็น <a> เพราะกดแล้วไม่มีอะไรเกิดขึ้นคือ UX ที่แย่กว่า
            // บอกตรง ๆ ว่า "ไวๆ นี้" แทน เพื่อให้เห็นว่ามีอะไรกำลังจะมา
            return (
              <VideoCard key={video.id} url={url}>
                <div data-glare className={styles.glare} />
                <div className={styles.videoThumb}>
                  <div className={styles.playCircle}>
                    <div className={styles.playTriangle} />
                  </div>
                  {url ? (
                    <span className={styles.videoDuration}>{video.duration}</span>
                  ) : (
                    <span className={styles.videoSoon}>{text("tutorialsSoon")}</span>
                  )}
                  <span className={styles.videoCat}>{video.category}</span>
                </div>
                <div className={styles.videoBody}>
                  <div className={styles.videoTitle}>{pickText(video.title, language)}</div>
                  <div className={styles.videoDesc}>{pickText(video.description, language)}</div>
                </div>
              </VideoCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function VideoCard({ url, children }: { url: string; children: ReactNode }) {
  if (!url) {
    return <div className={`${styles.videoCard} ${styles.videoCardSoon}`}>{children}</div>;
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" data-tilt className={styles.videoCard}>
      {children}
    </a>
  );
}
