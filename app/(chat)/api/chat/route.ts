import { convertToCoreMessages, Message, streamText } from "ai";
import { z } from "zod";

import { customModel } from "@/ai";
import { auth } from "@/app/(auth)/auth";
import { deleteChatById, getChatById, saveChat } from "@/db/queries";
import { LOCATION_QUERY_BY_NAME, RESERVATION_QUERY_BY_LOCATION_AND_DATE } from "@/lib/apollo/queries";
import { globalClient } from "@/lib/apollo/globalClient";

export async function POST(request: Request) {
  const { id, messages }: { id: string; messages: Array<Message> } =
    await request.json();

  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const coreMessages = convertToCoreMessages(messages);

  const result = await streamText({
    model: customModel,
    system:
      "you are a friendly assistant for a marina company with many locations! You will answer most questions about the marina by querying the database using the tools provided. Most of the data responses will be in JSON Format, with property names mostly self-explanatory. The marinas themselves are known a Locations in the database. The customers are known as Members. Individual boat launches are known as Reservations, except past reservations will usually come from the ArchivedReservations table. Anything involving a date or datetime will be a string in the format YYYYMMDDHHmmssfff. For example, if I asked you how many boats were launched in June, you might look for all past reservations with a LaunchDateTime greater than 20240601000000000 and less than 20240701000000000. Each Reservation is associate with a Boat, and a Member. Amenities are also known as Items, or IndividualItems in the database when they are given to a reservation.Keep your responses concise and helpful.",
    messages: coreMessages,
    maxSteps: 5,
    tools: {
      getWeather: {
        description: "Get the current weather at a location",
        parameters: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
        execute: async ({ latitude, longitude }) => {
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
          );

          const weatherData = await response.json();
          return weatherData;
        },
      },
      getMarinaData: {
        description: "Get data pertaining to a specific marina location",
        parameters: z.object({
          name: z.string(),
        }),
        execute: async ({name}) => {
          try {
            const { data: locationData, error: locationError } = await globalClient.query({
              query: LOCATION_QUERY_BY_NAME,
              variables: { Name: name },
            });
            if (locationError) {
              console.error("Error fetching location data`:", locationError);
              return { error: "Failed to fetch location data" };
            }

            if (locationData.Locations.length === 0) {
              return {
                error: "Something went wrong"
              }
            }
            const location = locationData.Locations[0];
            return location;
          } catch (error) {
            console.error("Error fetching location data:", error);
            return { error: "Failed to fetch location data" };
          }
        },
      },
      getPastReservations: {
        description: "Get data pertaining to past reservations at a specific marina location, in a given date range",
        parameters: z.object({
          marinaName: z.string(),
          startDateTime: z.string(),
          endDateTime: z.string(),
        }),
        execute: async ({marinaName, startDateTime, endDateTime}) => {
          try {
            const { data: reservationData, error: reservationError } = await globalClient.query({
              query: RESERVATION_QUERY_BY_LOCATION_AND_DATE,
              variables: { StartDateTime: startDateTime, EndDateTime: endDateTime, LocationName: marinaName },
            });
            if (reservationError) {
              console.error("Error fetching Reservation data`:", reservationError);
              return { error: "Failed to fetch reservation data" };
            }

            if (reservationData.ArchivedReservations.length === 0) {
              return {
                error: "Something went wrong"
              }
            }
            const reservations = reservationData.ArchivedReservations;
            return reservations;
          } catch (error) {
            console.error("Error fetching reservation data:", error);
            return { error: "Failed to fetch reservation data" };
          }
        },
      },
    },
    onFinish: async ({ responseMessages }) => {
      if (session.user && session.user.id) {
        try {
          await saveChat({
            id,
            messages: [...coreMessages, ...responseMessages],
            userId: session.user.id,
          });
        } catch (error) {
          console.error("Failed to save chat");
        }
      }
    },
    experimental_telemetry: {
      isEnabled: true,
      functionId: "stream-text",
    },
  });

  return result.toDataStreamResponse({});
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    await deleteChatById({ id });

    return new Response("Chat deleted", { status: 200 });
  } catch (error) {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}
