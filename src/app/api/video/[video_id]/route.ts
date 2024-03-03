import { NextRequest, NextResponse } from "next/server";
import aws from "aws-sdk";
import { headers } from "next/headers";

aws.config.update({
  secretAccessKey: process.env.BUCKET_ACCESS_SECRET,
  accessKeyId: process.env.BUCKET_ACCESS_KEY,
  region: process.env.BUCKET_REGION,
});

const s3 = new aws.S3();

export async function GET(
  request: NextRequest,
  { params }: { params: { video_id: string } }
) {
  const key = params?.video_id;
  const headerList = headers();
  const rangeHeader = headerList.get("range");

  const s3Params = {
    Bucket: process.env.BUCKET,
    Key: key,
    Range: "bytes=",
  };

  try {
    const objectMetadata = await s3.headObject(s3Params as any).promise();
    const fileSize = objectMetadata.ContentLength || 0;

    let start = 0;
    let end = fileSize - 1;

    if (rangeHeader) {
      const matches = rangeHeader.match(/bytes=([0-9]*)-([0-9]*)/);
      if (matches && matches.length === 3) {
        start = parseInt(matches[1], 10);
        end = matches[2] ? parseInt(matches[2], 10) : fileSize - 1;
      }
    }

    s3Params["Range"] = `bytes=${start}-${end}`;

    const stream = s3.getObject(s3Params as any).createReadStream();
    const response = new NextResponse(stream as any, { status: 206 });

    response.headers.set("Content-Type", "video/mp4");
    response.headers.set("Content-Length", `${end - start + 1}`);
    response.headers.set("Accept-Ranges", "bytes");
    response.headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);

    return response;
  } catch (error) {
    console.error("Error retrieving video:", error);
    return new NextResponse(null, { status: 500 });
  }
}
