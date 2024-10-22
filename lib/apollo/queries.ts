import { gql } from "@apollo/client";

export const LOCATION_QUERY_BY_NAME = gql`
  query GetLocationsById($Name: String!) {
    Locations(where: { Name: { _eq: $Name } }) {
      Name
      BookingWindow
      CancellationWindow
      ManagerEmail
      ManagerName
      SquareLocationId
      SquareAccessToken
      Id
      KioskUrl
      ChatStartTime
      ChatEndTime
    }
  }
`;

export const RESERVATION_QUERY_BY_LOCATION_AND_DATE = gql`
query GetPastReservations($StartDateTime: String, $EndDateTime: String, $LocationName: String) {
  ArchivedReservations(where: {Boat: {Location: {Name: {_ilike: $LocationName}}}, LaunchDateTime: {_gte: $StartDateTime, _lte: $EndDateTime}}) {
    IndividualItems {
      DispatchedQuantity
      Item {
        Name
      }
    }
    LaunchDateTime
    ReservationType {
      Name
    }
    Member {
      FirstName
      LastName
      City
      State
    }
  }
}
`;
