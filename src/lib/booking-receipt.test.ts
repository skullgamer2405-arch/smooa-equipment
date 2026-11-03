import { describe, expect, it } from "vitest";
import { bookingReceipt } from "./booking-receipt";

describe("booking receipt from navigation or session storage", () => {
  it("keeps only receipt fields and valid dates", () => {
    expect(bookingReceipt({bookingId:"example",startDate:"2035-06-10",endDate:"2035-06-11",privateData:"ignore"})).toEqual({bookingId:"example",startDate:"2035-06-10",endDate:"2035-06-11",lineRequested:false});
  });
  it("discards malformed receipt data instead of crashing the success route", () => {
    for (const value of [null, [], {bookingId:42}, {bookingId:"example",startDate:"not-a-date",endDate:"2035-06-11"}, {bookingId:"example",startDate:"2035-02-30"}, {bookingId:"example",lineRequested:"true"}]) {
      expect(bookingReceipt(value)).toBeNull();
    }
  });
});
