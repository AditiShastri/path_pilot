export type UpcomingCalendarEvent = {
  id: string;
  title: string;
  location: string;
  startTime: string;
  endTime: string;
};

export type CreateCalendarEventInput = {
  title: string;
  startTime: string;
  endTime: string;
  timeZone?: string;
  location?: string;
  description?: string;
  attendees?: string[];
};

export type CreatedCalendarEvent = {
  id: string;
  htmlLink?: string;
  title: string;
  startTime: string;
  endTime: string;
  location?: string;
};
