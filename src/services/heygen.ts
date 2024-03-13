import axios from 'axios'

const heygenKey = process.env.HEYGEN_API_KEY || ""

interface GenerateVideoProps {
  inputText: string;
  avatarId?: string
  voiceId?: string
}

export async function generateVideoHeygen({
  inputText,
  avatarId = "josh_lite_20230714",
  voiceId = "1bd001e7e50f421d891986aad5158bc8"
}: GenerateVideoProps) {
  const url = "https://api.heygen.com/v2/video/generate";

  try {
    const heygen_response = await axios.post(url, {
      "video_inputs": [
        {
          "character": {
            "type": "avatar",
            "avatar_id": avatarId,
            "avatar_style": "normal"
          },
          "voice": {
            "type": "text",
            "input_text": inputText,
            "voice_id": voiceId
          }
        }
      ],
      "test": true,
      "caption": false,
      "dimension": {
        "width": 1920,
        "height": 1080
      }
    },
    {
      headers: {
        "content-type": "application/json",
        "x-api-key": heygenKey
      }
    });
    console.log('HEYGEN RESPONSE: ', heygen_response)
    console.dir(heygen_response.data.data?.video_id)
    const videoId = heygen_response.data.data?.video_id

    return videoId
  } catch (err) {
    console.dir(err);
  }
}

export async function retrieveVideoHeygen(videoId: string) {
  const url = `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`

  try {
    const response = await axios.get(url, {
      headers: {
        "accept" : "application/json",
        "x-api-key": heygenKey
      }
    })
    console.log('DATA; ', response.data)
    return response.data
  } catch (err) {
    console.log(err)
  }
}