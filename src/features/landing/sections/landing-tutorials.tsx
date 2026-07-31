"use client";

import type { Language } from "@/lib/language";
import { landingVideos, pickText } from "../landing-data";
import { landingUi } from "../landing-ui";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

export function LandingTutorials({ language }: LandingSectionProps) {
  // การ์ดวิดีโอที่กดไม่ได้ทำให้หน้าดูค้างงาน — โชว์เฉพาะข้อที่มีลิงก์จริง
  // ยังไม่มีสักข้อ = ซ่อนทั้ง section
  const videos = landingVideos.filter((video) => video.url.trim());

  if (!videos.length) return null;

  return (
    <section id="tutorials" className={`${styles.section} ${styles.band}`}>
      <div className={styles.bandInner}>
        <div data-reveal className={`${styles.reveal} ${styles.tutorialsHead}`}>
          <div className={styles.kicker}>{pickText(landingUi.tutorialsKicker, language)}</div>
          <h2 className={styles.tutorialsTitle}>{pickText(landingUi.tutorialsTitle, language)}</h2>
          <p className={styles.tutorialsSubtitle}>{pickText(landingUi.tutorialsSubtitle, language)}</p>
        </div>
        <div data-reveal className={`${styles.reveal} ${styles.videosGrid}`}>
          {videos.map((video) => (
            <a
              key={video.id}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              data-tilt
              className={styles.videoCard}
            >
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
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
