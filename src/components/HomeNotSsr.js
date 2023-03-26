import Head from "next/head";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { useState, useEffect } from "react";
import { ensureConnected } from "@/utils/bluetooth/js/main";
import { replRawMode, replSend } from "@/utils/bluetooth/js/repl";
import { getHnTopArticleComments } from "@/utils/hacker-news/hn";
import { Button } from "antd";
import { useWhisper } from "@chengsokdara/use-whisper";
import { app } from "@/utils/app";
import { execMonocle } from "@/utils/comms";
import { useInterval } from "usehooks-ts";

const inter = Inter({ subsets: ["latin"] });

const HomeNotSsr = () => {
  const [connected, setConnected] = useState(false);
  const [hnArticleData, setHnArticleData] = useState(false); // type mixing
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptFull, setTranscriptFull] = useState("");

  const { startRecording, stopRecording, transcript } = useWhisper({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_TOKEN,
    streaming: true,
    timeSlice: 500, // 1 second
    whisperConfig: {
      language: "en",
      //   prompt: "You are the rizzler",
    },
    // removeSilence: true,
    // autoStart: true,
  });

  const fetchGpt = async () => {
    const userPrompt = window.transcript;
    console.log("fetching on transcript:", window.transcript);
    const systemPrompt = `
        You are CharismaGPT, a powerful conversationalist with incredibly high EQ.
        You are helping an individual decide what to say on their job interview. 
        Given a transcript between a guy (who is asking you for help) and a boss who may hire him, provide a concise response of what the individual should say next.
    `;
    const response = await fetch(`https://api.openai.com/v1/completions`, {
      body: JSON.stringify({
        model: "text-davinci-003",
        // messages: [
        //   { role: "system", content: systemPrompt },
        //   { role: "user", content: "transcript: " + userPrompt },
        // ],
        prompt:
          systemPrompt +
          "\ntranscript: " +
          userPrompt +
          "\noptimal guy's response: ",
        temperature: 0.7,
        max_tokens: 512,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const resJson = await response.json();
    const res = resJson?.choices?.[0]?.text;
    if (!res) return;
    await displayRawRizz(res);
    console.log("**** GPT RESPONSE ****", resJson?.choices?.[0]?.text);
  };

  //   useInterval(() => {
  //     if (transcript.text) {
  //       console.log("fetching on transcript", transcript.text);
  //       fetchGpt(transcript.text);
  //     }
  //   }, 500);

  useEffect(() => {
    window.transcript = transcript.text;
    // console.log(`updating transcript to: ${transcript.text}`);
  }, [transcript.text]);

  //   console.log("transcript.text", transcript.text);

  useEffect(() => {
    if (Object.keys(hnArticleData).length) {
      displayHnArticleComments(hnArticleData);
    }
  }, [hnArticleData]);

  //   useEffect(() => {
  //     displayRizz();
  //   }, []);
  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`${inter.className} ${styles.main}`}>
        <div className="flex w-screen h-screen flex-col items-center justify-center">
          <p className="text-3xl">{connected ? "Connected" : "Disconnected"}</p>
          {transcript.text}
          <Button
            type="primary"
            onClick={async () => {
              await ensureConnected(logger, relayCallback);
              app.run(execMonocle);
              await displayRawRizz();
            }}
          >
            Connect
          </Button>
          {/* <Button onClick={onRecord}>Start recording</Button>
          <Button onClick={onStopRecord}>Stop recording</Button> */}
        </div>
      </main>
    </>
  );

  function relayCallback(msg) {
    if (!msg) {
      return;
    }
    if (msg.trim() === "trigger b") {
      // flipped back view (left)
      //   console.log("fetching on transcript", transcript.text);
      fetchGpt();
    }

    if (msg.trim() === "trigger a") {
      // (right)
      onRecord();
    }
  }

  function onRecord() {
    console.log("changing recording.");
    isRecording ? stopRecording() : startRecording();
    setIsRecording(!isRecording);
  }

  function onStopRecord() {
    stopRecording();
    setIsRecording(false);
  }

  async function getHn() {
    const hnData = await getHnTopArticleComments();
    setHnArticleData(hnData);
  }

  function wrapText(inputText) {
    const length = inputText.length;
    const block = 30;
    let text = [];
    for (let i = 0; i < 6; i++) {
      text.push(
        inputText.substring(block * i, block * (i + 1)).replace("\n", "")
      );
    }

    console.log("text", text);
    return text;
  }

  async function displayRizz(rizz) {
    if (!rizz) return;
    const splitText = wrapText(rizz);
    let replCmd = "import display;";

    for (let i = 0; i < splitText.length; i++) {
      replCmd += `display.text("${splitText[i]}", 0, ${i * 50}, 0xffffff);`;
    }

    // replCmd += `display.text("Helllllllllllloooooooo bryan chiang was here", 0, 0, 0xffffff);`;
    // replCmd += `display.text("Helllllllllllloooooooo bryan chiang was here", 0, 50, 0xffffff);`;

    // replCmd += `display.text("${body.title.substring(
    //   0,
    //   21
    // )}", 0, 0, 0xffffff);`;
    // replCmd += `display.text("${body.comment.substring(
    //   0,
    //   21
    // )}", 0, 50, 0xffffff);`;
    replCmd += "display.show();";

    console.log("send", replCmd);

    await replSend(replCmd);
  }

  function displayHnArticleComment(articleComments) {
    return new Promise((resolve) => {
      const articleIds = Object.keys(articleComments);

      if (articleIds.length) {
        const body = articleComments[articleIds[0]];

        setTimeout(async () => {
          let replCmd = "import display;";

          replCmd += `display.text("${body.title.substring(
            0,
            21
          )}", 0, 0, 0xffffff);`;
          replCmd += `display.text("${body.comment.substring(
            0,
            21
          )}", 0, 50, 0xffffff);`;
          replCmd += "display.show();";

          console.log("send", replCmd);

          await replSend(replCmd);
          delete articleComments[articleIds[0]];
          displayHnArticleComment(articleComments);
        }, 5000);
      } else {
        resolve(""); // done
      }
    });
  }

  async function displayRawRizz(rizz) {
    await replRawMode(true);
    await displayRizz(rizz);
  }

  async function displayHnArticleComments(hnArticleComments) {
    await replRawMode(true);
    await displayHnArticleComment(hnArticleComments);
  }

  async function logger(msg) {
    if (msg === "Connected") {
      setConnected(true);
    }

    // getHn();
  }
};

export default HomeNotSsr;
