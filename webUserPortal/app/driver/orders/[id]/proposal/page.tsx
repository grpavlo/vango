import DriverOrder from "../../../driver-order";

export default async function DriverOrderProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DriverOrder orderId={Number(id)} proposal/>;
}
