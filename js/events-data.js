/* =========================================================
   SUPRAGNA '27 - REGISTRATION DATA

   The page builds the event tickets, the "Wanted" posters and
   the printed Admit One ticket from this file, so this is the
   only place to edit content.

   PLACEHOLDER: event names, team sizes, venues, prizes and
   rules below are stand-ins until the real list arrives.
   Set seatsFull: true to stamp a ticket "SEATS FULL" and
   stop people picking it.
========================================================= */
window.SUPRAGNA_DATA = {
    fest: {
        name: "Supragna",
        edition: "'27",
        tagline: "The Grand Carnival",
        host: "Siddhartha Academy of Higher Education",
        dates: "TBA",
        venue: "SAHE Campus",
    },

    /* order of the filter tabs */
    categories: ["Dance", "Music", "Fashion", "Theatre", "Film"],

    events: [
        {
            id: "step-up",
            name: "Step Up",
            category: "Dance",
            team: { min: 6, max: 15 },
            date: "TBA",
            venue: "Main Stage",
            prize: "₹ TBA",
            rules: [
                "6 to 15 dancers per crew, any style.",
                "6 to 8 minutes on stage, including entry and exit.",
                "Send your track to the organisers a day before.",
            ],
        },
        {
            id: "solo-spotlight",
            name: "Solo Spotlight",
            category: "Dance",
            team: { min: 1, max: 1 },
            date: "TBA",
            venue: "Open Air Theatre",
            prize: "₹ TBA",
            rules: [
                "One dancer, any style.",
                "3 to 4 minutes on stage.",
                "Props are allowed if you set them up yourself.",
            ],
        },
        {
            id: "duet-dynamics",
            name: "Duet Dynamics",
            category: "Dance",
            team: { min: 2, max: 2 },
            date: "TBA",
            venue: "Open Air Theatre",
            prize: "₹ TBA",
            seatsFull: true,
            rules: [
                "Two dancers per pair.",
                "4 to 5 minutes on stage.",
                "Judged on sync, choreography and expression.",
            ],
        },
        {
            id: "battle-of-bands",
            name: "Battle of Bands",
            category: "Music",
            team: { min: 3, max: 8 },
            date: "TBA",
            venue: "Main Stage",
            prize: "₹ TBA",
            rules: [
                "3 to 8 members; bring your own instruments.",
                "15 minutes including sound check.",
                "Drum kit and amps are provided on stage.",
            ],
        },
        {
            id: "solo-singing",
            name: "Solo Singing",
            category: "Music",
            team: { min: 1, max: 1 },
            date: "TBA",
            venue: "Seminar Hall",
            prize: "₹ TBA",
            rules: [
                "Any language, any genre.",
                "Up to 4 minutes per round.",
                "Karaoke tracks without lead vocals only.",
            ],
        },
        {
            id: "rap-arena",
            name: "Rap Arena",
            category: "Music",
            team: { min: 1, max: 1 },
            date: "TBA",
            venue: "Seminar Hall",
            prize: "₹ TBA",
            rules: [
                "Written round, then a freestyle round.",
                "Beats are played by the organisers.",
                "No hate speech; it means disqualification.",
            ],
        },
        {
            id: "ramp-royale",
            name: "Ramp Royale",
            category: "Fashion",
            team: { min: 8, max: 15 },
            date: "TBA",
            venue: "Main Stage",
            prize: "₹ TBA",
            rules: [
                "8 to 15 models plus up to 2 backstage crew.",
                "10 minutes on the ramp, theme of your choice.",
                "Share your theme and music a day before.",
            ],
        },
        {
            id: "style-street",
            name: "Style Street",
            category: "Fashion",
            team: { min: 1, max: 1 },
            date: "TBA",
            venue: "Central Lawn",
            prize: "₹ TBA",
            rules: [
                "Solo walk-in look, judged on the spot.",
                "Theme is announced on the day.",
                "One minute to pitch your look.",
            ],
        },
        {
            id: "stage-play",
            name: "Stage Play",
            category: "Theatre",
            team: { min: 5, max: 15 },
            date: "TBA",
            venue: "Auditorium",
            prize: "₹ TBA",
            rules: [
                "5 to 15 actors, any language.",
                "30 minutes including setup.",
                "Basic lights and mics are provided.",
            ],
        },
        {
            id: "mime-act",
            name: "Mime Act",
            category: "Theatre",
            team: { min: 3, max: 8 },
            date: "TBA",
            venue: "Auditorium",
            prize: "₹ TBA",
            rules: [
                "3 to 8 performers, no spoken words.",
                "8 to 10 minutes on stage.",
                "Background music is allowed.",
            ],
        },
        {
            id: "nukkad-natak",
            name: "Nukkad Natak",
            category: "Theatre",
            team: { min: 8, max: 20 },
            date: "TBA",
            venue: "Central Lawn",
            prize: "₹ TBA",
            rules: [
                "8 to 20 performers, performed in the round.",
                "15 minutes, no mics or recorded music.",
                "Live instruments are allowed.",
            ],
        },
        {
            id: "short-film",
            name: "Short Film",
            category: "Film",
            team: { min: 1, max: 6 },
            date: "TBA",
            venue: "Mini Theatre",
            prize: "₹ TBA",
            rules: [
                "Up to 10 minutes, shot after registration opens.",
                "Submit an MP4 link before the deadline.",
                "Subtitles needed for non-English films.",
            ],
        },
        {
            id: "reel-rush",
            name: "Reel Rush",
            category: "Film",
            team: { min: 1, max: 3 },
            date: "TBA",
            venue: "Across campus",
            prize: "₹ TBA",
            rules: [
                "A 60-second vertical reel, shot on campus.",
                "Theme is announced on the day.",
                "Phones only; editing apps are fine.",
            ],
        },
    ],
};
