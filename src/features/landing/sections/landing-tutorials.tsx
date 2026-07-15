"use client";

import { useState } from "react";
import type { Language } from "@/lib/language";
import { landingProjects, landingUi, landingVideos, pickText } from "../landing-data";
import styles from "../landing.module.css";

interface LandingSectionProps {
  language: Language;
}

export function LandingTutorials({ language }: LandingSectionProps) {
  const [filter, setFilter] = useState("all");

  const filters = [
    { id: "all", label: pickText(landingUi.filterAll, language) },
    ...landingProjects.map((project) => ({ id: project.id, label: project.name }))
  ];
  const videos = landingVideos.filter((video) => filter === "all" || video.projectId === filter);
  const projectName = (id: string) => landingProjects.find((project) => project.id === id)?.name ?? "";

  return (
    <section id="tutorials" className={`${styles.section} ${styles.band}`}>
      <div className={styles.bandInner}>
        <div data-reveal className={`${styles.reveal} ${styles.tutorialsHead}`}>
          <div className={styles.kicker}>▶</div>
          <h2 className={styles.tutorialsTitle}>{pickText(landingUi.tutorialsTitle, language)}</h2>
          <p className={styles.tutorialsSubtitle}>{pickText(landingUi.tutorialsSubtitle, language)}</p>
        </div>
        <div className={styles.filterRow}>
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={filter === item.id ? `${styles.filterBtn} ${styles.filterBtnActive}` : styles.filterBtn}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div data-reveal className={`${styles.reveal} ${styles.videosGrid}`}>
          {videos.map((video) => (
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
                <div className={styles.videoProject}>{projectName(video.projectId)}</div>
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
