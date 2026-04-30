import ical from "node-ical";

export const fetchICal = async (url) => {
  try {
    const data = await ical.async.fromURL(url);

    const events = [];

    for (let key in data) {
      const event = data[key];

      if (event.type === "VEVENT") {
        events.push({
          uid: event.uid,
          summary: event.summary,
          start: event.start,
          end: event.end
        });
      }
    }

    return events;
  } catch (error) {
    console.error("iCal fetch error:", error.message);
    return [];
  }
};